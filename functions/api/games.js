/**
 * GET /api/games — 게임 목록(그리드용)
 *
 *   sys   기종 slug (예: gba). 없으면 전체
 *   q     검색어 (한글 제목·영문 제목)
 *   year  발매 연도
 *   page  1부터
 *   sort  name(기본) | year | year_asc | note(평점 높은순) | staff(추천 먼저)
 *
 * 썸네일이 있는 게임을 앞에 둔다 — 감상용이라 그림 없는 항목이 먼저 나오면 허전하다.
 */
const PAGE_SIZE = 60;

export async function onRequestGet({ request, env }) {
  const u = new URL(request.url);
  const slug = (u.searchParams.get('sys') || '').trim();
  const q = (u.searchParams.get('q') || '').trim();
  const year = parseInt(u.searchParams.get('year') || '', 10);
  const page = Math.max(1, parseInt(u.searchParams.get('page') || '1', 10) || 1);
  const sort = u.searchParams.get('sort') || 'name';

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
  // 평점·추천 정렬에서는 그 순서가 곧 목적이므로 '같은 순위 안에서의 동점 처리'로만 쓴다
  // — 앞세우면 그림 없는 20점 게임이 그림 있는 1점 게임보다 뒤로 밀린다.
  // 평점은 NULL 이 많은데 SQLite 는 NULL 을 가장 작게 보므로 DESC 면 NULL 이 앞으로 온다.
  // (note IS NULL) 을 먼저 걸어 점수 없는 게임을 뒤로 보낸다.
  const T = '(thumb IS NULL)';
  const order = {
    year: `${T}, year DESC, name_kor`,
    year_asc: `${T}, year ASC, name_kor`,
    note: `(note IS NULL), note DESC, ${T}, name_kor`,
    staff: `(topstaff IS NOT 1), (note IS NULL), note DESC, ${T}, name_kor`,
  }[sort] || `${T}, name_kor`;
  const orderBy = `ORDER BY ${order}`;

  try {
    const [{ total }, list] = await Promise.all([
      env.DB.prepare(`SELECT COUNT(*) AS total FROM web_games ${cond}`).bind(...bind).first(),
      env.DB.prepare(
        `SELECT slug, sys_id, game_id, name, name_kor, year, genre, thumb, note, topstaff
           FROM web_games ${cond} ${orderBy}
          LIMIT ? OFFSET ?`
      ).bind(...bind, PAGE_SIZE, (page - 1) * PAGE_SIZE).all(),
    ]);

    let system = null;
    if (slug) {
      system = await env.DB.prepare(
        'SELECT slug, sys_id, name, game_count FROM systems WHERE slug = ?'
      ).bind(slug).first();
    }

    return json({
      ok: true, system, page, pageSize: PAGE_SIZE, total,
      pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      games: list.results,
    }, 3600);
  } catch (e) {
    return json({ ok: false, error: String(e && e.message || e) }, 0, 500);
  }
}

function json(obj, maxAge = 0, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': maxAge ? `public, max-age=${maxAge}` : 'no-store',
    },
  });
}
