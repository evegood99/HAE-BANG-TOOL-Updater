/**
 * GET /api/systems — 플랫폼(기종) 목록
 *
 * D1 바인딩은 wrangler.toml 의 [[d1_databases]] binding = "DB" 로 주입된다.
 * 응답은 하루 캐시 — 기종 목록은 거의 바뀌지 않는다(엣지 캐시로 D1 조회를 아낀다).
 */
export async function onRequestGet({ env }) {
  try {
    const { results } = await env.DB.prepare(
      `SELECT slug, sys_id, name, game_count
         FROM systems
        WHERE game_count > 0
        ORDER BY game_count DESC`
    ).all();

    return json({ ok: true, systems: results }, 86400);
  } catch (e) {
    // 바인딩 미설정/쿼리 실패를 조용히 넘기지 않는다(초기 설정 실수 조기 발견).
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
