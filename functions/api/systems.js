/**
 * GET /api/systems — 플랫폼(기종) 목록
 *
 * D1 바인딩은 wrangler.toml 의 [[d1_databases]] binding = "DB" 로 주입된다.
 * 기종 목록은 DB 를 다시 적재할 때만 바뀌므로 엣지에 하루 담아 둔다.
 */
import { cached, json } from './_cache.js';

export async function onRequestGet(context) {
  return cached(context, 86400, async () => {
    try {
      const { results } = await context.env.DB.prepare(
        `SELECT slug, sys_id, name, game_count
           FROM systems
          WHERE game_count > 0
          ORDER BY name COLLATE NOCASE ASC`
      ).all();

      return json({ ok: true, systems: results });
    } catch (e) {
      // 바인딩 미설정/쿼리 실패를 조용히 넘기지 않는다(초기 설정 실수 조기 발견).
      return json({ ok: false, error: String(e && e.message || e) }, 500);
    }
  });
}
