/**
 * GET /api/featured          — 오늘의 게임(날짜별 고정)
 * GET /api/featured?random=1 — 무작위 게임(누를 때마다 다름)
 *
 * 썸네일이 있는 게임 중에서만 고른다(감상용이라 그림 없는 항목은 의미가 없다).
 */
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const isRandom = url.searchParams.get('random') === '1';

  try {
    const row = isRandom
      ? await pickRandom(env)
      : await pickOfTheDay(env);

    if (!row) return json({ ok: false, error: 'no game' }, 0, 404);
    // 오늘의 게임은 하루 캐시, 무작위는 캐시하지 않는다.
    return json({ ok: true, game: row }, isRandom ? 0 : 3600);
  } catch (e) {
    return json({ ok: false, error: String(e && e.message || e) }, 0, 500);
  }
}

const COLS = `slug, sys_id, game_id, name, name_kor, description_kor,
              genre, year, developer, thumb, note, topstaff`;

function pickRandom(env) {
  return env.DB.prepare(
    `SELECT ${COLS} FROM web_games
      WHERE thumb IS NOT NULL
      ORDER BY RANDOM() LIMIT 1`
  ).first();
}

async function pickOfTheDay(env) {
  // 날짜(UTC 기준 일수)로 OFFSET 을 정해 하루 동안 같은 게임이 나오게 한다.
  const day = Math.floor(Date.now() / 86400000);
  const { total } = await env.DB.prepare(
    'SELECT COUNT(*) AS total FROM web_games WHERE thumb IS NOT NULL'
  ).first();
  if (!total) return null;
  const offset = day % total;
  return env.DB.prepare(
    `SELECT ${COLS} FROM web_games
      WHERE thumb IS NOT NULL
      ORDER BY sys_id, game_id
      LIMIT 1 OFFSET ?`
  ).bind(offset).first();
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
