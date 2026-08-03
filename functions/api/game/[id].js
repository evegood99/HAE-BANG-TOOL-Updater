/**
 * GET /api/game/{game_id}?sys={slug} — 게임 상세 + 미디어 목록
 *
 * game_id 는 기종이 달라도 겹치지 않지만(스크래퍼 전역 ID), fbneo/mame 처럼
 * sys_id 를 공유하는 기종이 있어 slug 를 함께 받아 어느 플랫폼의 항목인지 확정한다.
 *
 * 미디어는 media/<sys_id>/<filename> 규약이라, 응답에는 파일명만 담고
 * 실제 URL 조립은 프론트에서 한다(나중에 도메인이 바뀌어도 API 는 그대로).
 */
import { cached } from '../_cache.js';

export async function onRequestGet(context) {
  // 게임 한 건은 DB 를 다시 적재할 때만 바뀐다 — 엣지에 하루 담아 둔다.
  return cached(context, 86400, () => build(context));
}

async function build({ params, request, env }) {
  const gameId = parseInt(params.id, 10);
  const slug = (new URL(request.url).searchParams.get('sys') || '').trim();
  if (!gameId) return json({ ok: false, error: 'bad id' }, 0, 400);

  try {
    const game = slug
      ? await env.DB.prepare(
          'SELECT * FROM web_games WHERE slug = ? AND game_id = ?').bind(slug, gameId).first()
      : await env.DB.prepare(
          'SELECT * FROM web_games WHERE game_id = ? LIMIT 1').bind(gameId).first();

    if (!game) return json({ ok: false, error: 'not found' }, 0, 404);

    const { results: media } = await env.DB.prepare(
      `SELECT type, region, filename FROM media
        WHERE sys_id = ? AND game_id = ?
        ORDER BY type, region`
    ).bind(game.sys_id, gameId).all();

    // 같은 기종의 이웃 게임(이전/다음) — 갤러리처럼 계속 넘겨볼 수 있게
    const [prev, next] = await Promise.all([
      env.DB.prepare(
        `SELECT game_id, name_kor, name FROM web_games
          WHERE slug = ? AND name_kor < ? ORDER BY name_kor DESC LIMIT 1`
      ).bind(game.slug, game.name_kor || '').first(),
      env.DB.prepare(
        `SELECT game_id, name_kor, name FROM web_games
          WHERE slug = ? AND name_kor > ? ORDER BY name_kor ASC LIMIT 1`
      ).bind(game.slug, game.name_kor || '').first(),
    ]);

    return json({ ok: true, game, media, prev, next }, 3600);
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
