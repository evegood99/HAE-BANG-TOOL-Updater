/**
 * GET /api/featured          — 오늘의 게임(날짜별 고정)
 * GET /api/featured?random=1 — 무작위 게임(누를 때마다 다름)
 *
 * 고르는 범위: 스탭 추천작이면서 20점 만점에 15점 이상, 그리고 썸네일이 있는 게임.
 * 7만 개 전체에서 뽑으면 이름 없는 항목이 대문에 걸리기 쉬워, 대표작만 후보로 둔다.
 *
 * 후보를 그때그때 골라내면(WHERE topstaff=1 AND note BETWEEN …) 조건에 맞는 2,700여 개를
 * 전부 훑게 되고, ORDER BY RANDOM() 은 거기에 줄 세우기까지 얹어 5,463행을 읽었다.
 * 기종만 좁혀도 3,207행 — 플래너가 추천작 인덱스를 먼저 타서 후보 전체를 보기 때문이다.
 * 그래서 후보에 미리 번호를 매겨 둔 작은 표 두 개를 두고 번호로 바로 집는다(5행).
 *
 *   featured_sys  (i 0..42, slug, cnt)      기종과 그 기종의 후보 수
 *   featured_pool (slug, k 0..cnt-1, game_id)  기종 안에서의 번호
 *
 * 기종을 먼저 고르고 그 안에서 하나를 뽑으므로, 후보가 많은 기종(ps2 439개)이
 * 대문을 독차지하지 않고 기종이 골고루 나온다.
 */
import { cached, json, untilNextDay } from './_cache.js';

const COLS = ['slug', 'sys_id', 'game_id', 'name', 'name_kor', 'description_kor',
              'genre', 'year', 'developer', 'thumb', 'note', 'topstaff']
  .map((c) => 'g.' + c).join(', ');

// 날짜마다 성큼성큼 건너뛰기 위한 보폭. 소수라 개수와 서로소가 되어 결국 전부 거친다.
// 기종과 게임에 서로 다른 값을 써서 같은 조합이 반복되지 않게 한다.
const STRIDE_SYS = 7919;
const STRIDE_GAME = 104729;

export async function onRequestGet(context) {
  const isRandom = new URL(context.request.url).searchParams.get('random') === '1';
  const build = async () => {
    try {
      const row = await pick(context.env, isRandom);
      if (!row) return json({ ok: false, error: 'no game' }, 404);
      return json({ ok: true, game: row });
    } catch (e) {
      return json({ ok: false, error: String(e && e.message || e) }, 500);
    }
  };
  return isRandom ? build() : cached(context, untilNextDay(), build);
}

async function pick(env, isRandom) {
  // ① 기종 수 — 기본키 최댓값이라 1행
  const { mx } = await env.DB.prepare('SELECT MAX(i) AS mx FROM featured_sys').first();
  if (mx === null || mx === undefined) return null;
  const nSys = mx + 1;
  const day = Math.floor(Date.now() / 86400000);

  // ② 기종 하나 — 기본키로 바로 집어 1행
  const si = isRandom ? Math.floor(Math.random() * nSys) : (day * STRIDE_SYS) % nSys;
  const sys = await env.DB.prepare('SELECT slug, cnt FROM featured_sys WHERE i = ?')
    .bind(si).first();
  if (!sys || !sys.cnt) return null;

  // ③ 그 기종 안에서 하나 — (slug, k) 기본키로 바로 집어 3행
  const k = isRandom ? Math.floor(Math.random() * sys.cnt) : (day * STRIDE_GAME) % sys.cnt;
  return env.DB.prepare(
    `SELECT ${COLS} FROM featured_pool p
       JOIN web_games g ON g.slug = p.slug AND g.game_id = p.game_id
      WHERE p.slug = ? AND p.k = ?`
  ).bind(sys.slug, k).first();
}
