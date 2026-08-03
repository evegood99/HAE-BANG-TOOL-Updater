/**
 * GET /api/featured          — 오늘의 게임(날짜별 고정)
 * GET /api/featured?random=1 — 무작위 게임(누를 때마다 다름)
 *
 * 고르는 범위: 스탭 추천작이면서 20점 만점에 15점 이상, 그리고 썸네일이 있는 게임.
 * 7만 개 전체에서 뽑으면 이름 없는 항목이 대문에 걸리기 쉬워, 대표작만 후보로 둔다.
 * (43개 기종 2,700여 개)
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
const POOL = 'topstaff = 1 AND note BETWEEN 15 AND 20 AND thumb IS NOT NULL';
// 날짜마다 후보 목록을 성큼성큼 건너뛰기 위한 보폭. 소수라 후보 수와 서로소가 되어
// 결국 모든 후보를 한 번씩 거친다. 1씩 늘리면 같은 기종이 몇 달씩 이어진다
// (기종·ID 순으로 늘어놓기 때문에 PS2 만 439일 연속으로 나오는 식).
const STRIDE = 7919;

function pickRandom(env) {
  return env.DB.prepare(
    `SELECT ${COLS} FROM web_games WHERE ${POOL} ORDER BY RANDOM() LIMIT 1`
  ).first();
}

async function pickOfTheDay(env) {
  // 날짜(UTC 기준 일수)로 OFFSET 을 정해 하루 동안 같은 게임이 나오게 한다.
  const day = Math.floor(Date.now() / 86400000);
  const { total } = await env.DB.prepare(
    `SELECT COUNT(*) AS total FROM web_games WHERE ${POOL}`
  ).first();
  if (!total) return null;
  const offset = (day * STRIDE) % total;
  return env.DB.prepare(
    `SELECT ${COLS} FROM web_games WHERE ${POOL}
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
