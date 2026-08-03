/**
 * GET /api/years         — 연도별 게임 수(타임라인용)
 * GET /api/years?sys=gba — 특정 기종만
 *
 * 1971~2024 범위. 게임이 몰린 시기(1990년대 초중반)를 한눈에 보여주는 용도라
 * 연도와 개수만 반환하고 목록은 /api/games?year= 로 따로 받는다.
 *
 * 전체 집계는 5만 행을 훑는 무거운 질의다. 값이 바뀌는 건 DB 를 다시 적재할 때뿐이라
 * 엣지에 하루 담아 두고 쓴다.
 */
import { cached, json } from './_cache.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const slug = (new URL(request.url).searchParams.get('sys') || '').trim();

  return cached(context, 86400, async () => {
    try {
      const sql = `SELECT year, COUNT(*) AS n FROM web_games
                    WHERE year IS NOT NULL ${slug ? 'AND slug = ?' : ''}
                    GROUP BY year ORDER BY year`;
      const st = env.DB.prepare(sql);
      const { results } = await (slug ? st.bind(slug) : st).all();
      return json({ ok: true, years: results });
    } catch (e) {
      return json({ ok: false, error: String(e && e.message || e) }, 500);
    }
  });
}
