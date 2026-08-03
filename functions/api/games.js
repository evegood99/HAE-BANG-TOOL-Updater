/**
 * GET /api/games — 게임 목록(그리드용)
 *
 *   sys   기종 slug (예: gba). 없으면 전체
 *   q     검색어 (한글 제목·영문 제목) — 두 글자 이상
 *   year  발매 연도
 *   page  1부터
 *   sort  staff(추천 먼저) | note(평점) | name | year | year_asc
 *
 * 정렬은 식(expression)으로 하되, 같은 식으로 만든 인덱스가 있어야 인덱스를 탄다.
 * 없으면 60개를 보여주려고 그 기종 전체를 읽고 줄 세운다(dos 기준 16,000행).
 *   idx_g_staff / idx_g_note / idx_g_name — ORDER BY 와 순서·방향이 정확히 같아야 한다.
 */
import { cached, json } from './_cache.js';

const PAGE_SIZE = 60;
const MIN_Q = 2;        // 한 글자 검색은 전체를 훑게 되므로 막는다
const COUNT_CAP = 2000; // 검색은 인덱스를 못 타므로 총계 세는 것도 여기서 끊는다

export async function onRequestGet(context) {
  const u = new URL(context.request.url);
  const slug = (u.searchParams.get('sys') || '').trim();
  const qRaw = (u.searchParams.get('q') || '').trim();
  const q = qRaw.length >= MIN_Q ? qRaw : '';
  const year = parseInt(u.searchParams.get('year') || '', 10);
  const page = Math.max(1, parseInt(u.searchParams.get('page') || '1', 10) || 1);
  const sort = u.searchParams.get('sort') || 'name';

  return cached(context, 3600, async () => {
    const where = [];
    const bind = [];
    if (slug) { where.push('slug = ?'); bind.push(slug); }
    if (year) { where.push('year = ?'); bind.push(year); }
    if (q) {
      // 한글·영문 어느 쪽으로 검색해도 걸리게 한다.
      where.push('(name_kor LIKE ? OR name LIKE ?)');
      bind.push(`%${q}%`, `%${q}%`);
    }
    const cond = where.length ? `WHERE ${where.join(' AND ')}` : '';

    // 감상용이라 그림 없는 항목이 먼저 나오면 허전하다. 그래서 썸네일 있는 것을 앞에 두되,
    // 평점·추천 정렬에서는 그 순서가 곧 목적이므로 '같은 순위 안에서의 동점 처리'로만 쓴다.
    // 평점은 NULL 이 많은데 SQLite 는 NULL 을 가장 작게 보므로 DESC 면 NULL 이 앞으로 온다.
    const T = '(thumb IS NULL)';
    const order = {
      year: `${T}, year DESC, name_kor`,
      year_asc: `${T}, year ASC, name_kor`,
      note: `(note IS NULL), note DESC, ${T}, name_kor`,
      staff: `(topstaff IS NOT 1), (note IS NULL), note DESC, ${T}, name_kor`,
    }[sort] || `${T}, name_kor`;

    try {
      const [count, list] = await Promise.all([
        countOf(context.env, slug, q, year, cond, bind),
        context.env.DB.prepare(
          `SELECT slug, sys_id, game_id, name, name_kor, year, genre, thumb, note, topstaff
             FROM web_games ${cond} ORDER BY ${order}
            LIMIT ? OFFSET ?`
        ).bind(...bind, PAGE_SIZE, (page - 1) * PAGE_SIZE).all(),
      ]);

      let system = null;
      if (slug) {
        system = await context.env.DB.prepare(
          'SELECT slug, sys_id, name, game_count FROM systems WHERE slug = ?'
        ).bind(slug).first();
      }

      return json({
        ok: true, system, page, pageSize: PAGE_SIZE,
        total: count.total, capped: count.capped,
        pages: Math.max(1, Math.ceil(count.total / PAGE_SIZE)),
        minQ: qRaw && !q ? MIN_Q : undefined,
        games: list.results,
      });
    } catch (e) {
      return json({ ok: false, error: String(e && e.message || e) }, 500);
    }
  });
}

/** 총 개수 — 굳이 세지 않아도 되는 경우를 먼저 걸러낸다. */
async function countOf(env, slug, q, year, cond, bind) {
  // ① 기종만 볼 때는 systems 에 이미 총계가 있다(7만 행 세는 대신 1행).
  if (slug && !q && !year) {
    const r = await env.DB.prepare('SELECT game_count AS total FROM systems WHERE slug = ?')
      .bind(slug).first();
    if (r) return { total: r.total, capped: false };
  }
  // ② 검색은 LIKE '%…%' 라 인덱스를 못 탄다. 전부 세면 기종 전체(또는 7만 행)를 훑으므로
  //    상한을 두고 끊는다. 화면에는 '2,000+' 로 표시한다.
  if (q) {
    const r = await env.DB.prepare(
      `SELECT COUNT(*) AS total FROM (SELECT 1 FROM web_games ${cond} LIMIT ${COUNT_CAP})`
    ).bind(...bind).first();
    return { total: r.total, capped: r.total >= COUNT_CAP };
  }
  const r = await env.DB.prepare(`SELECT COUNT(*) AS total FROM web_games ${cond}`)
    .bind(...bind).first();
  return { total: r.total, capped: false };
}
