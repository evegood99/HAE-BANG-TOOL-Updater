/**
 * GET /api/games — 게임 목록(그리드용)
 *
 *   sys   기종 slug (예: gba). 없으면 전체
 *   q     검색어 (한글 제목·영문 제목)
 *   year  발매 연도
 *   page  1부터
 *   sort  name(기본) | year | year_asc
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

  const order = {
    year: 'year DESC, name_kor',
    year_asc: 'year ASC, name_kor',
  }[sort] || 'name_kor';
  // 썸네일 있는 것 우선 → 지정한 정렬
  const orderBy = `ORDER BY (thumb IS NULL), ${order}`;

  try {
    const [{ total }, list] = await Promise.all([
      env.DB.prepare(`SELECT COUNT(*) AS total FROM web_games ${cond}`).bind(...bind).first(),
      env.DB.prepare(
        `SELECT slug, sys_id, game_id, name, name_kor, year, genre, thumb
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
