/**
 * GET /api/years         — 연도별 게임 수(타임라인용)
 * GET /api/years?sys=gba — 특정 기종만
 *
 * 1971~2024 범위. 게임이 몰린 시기(1990년대 초중반)를 한눈에 보여주는 용도라
 * 연도와 개수만 반환하고 목록은 /api/games?year= 로 따로 받는다.
 */
export async function onRequestGet({ request, env }) {
  const slug = (new URL(request.url).searchParams.get('sys') || '').trim();
  try {
    const sql = `SELECT year, COUNT(*) AS n FROM web_games
                  WHERE year IS NOT NULL ${slug ? 'AND slug = ?' : ''}
                  GROUP BY year ORDER BY year`;
    const st = env.DB.prepare(sql);
    const { results } = await (slug ? st.bind(slug) : st).all();
    return json({ ok: true, years: results }, 86400);
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
