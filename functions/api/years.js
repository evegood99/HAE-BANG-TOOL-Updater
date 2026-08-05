/**
 * GET /api/years         — 연도별 게임 수(타임라인용)
 * GET /api/years?sys=gba — 특정 기종만
 *
 * 1971~2024 범위. 게임이 몰린 시기(1990년대 초중반)를 한눈에 보여주는 용도라
 * 연도와 개수만 반환하고 목록은 /api/games?year= 로 따로 받는다.
 *
 * 그때그때 GROUP BY 로 세면 5만 3천 행을 훑는다 — 이 사이트에서 가장 무거운 질의였다.
 * 값이 바뀌는 건 DB 를 다시 적재할 때뿐이라, 미리 세어 둔 year_counts 를 읽는다(55행).
 *   year_counts(slug, year, n)   slug='' 이 전체 집계
 */
import { cached, json } from './_cache.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const slug = (new URL(request.url).searchParams.get('sys') || '').trim();

  return cached(context, 86400, async () => {
    try {
      // 전체 집계는 fbneo 를 뺀다. 목록(/api/games)에서 mame 와 겹치는 fbneo 를
      // 빼고 보여주므로, 막대 숫자와 목록 개수가 어긋나지 않게 여기서도 맞춘다.
      const { results } = slug
        ? (await env.DB.prepare(
            'SELECT year, n FROM year_counts WHERE slug = ? ORDER BY year'
          ).bind(slug).all())
        : (await env.DB.prepare(
            "SELECT y.year, y.n - IFNULL(f.n, 0) AS n FROM year_counts y" +
            "  LEFT JOIN year_counts f ON f.slug = 'fbneo' AND f.year = y.year" +
            " WHERE y.slug = '' ORDER BY y.year"
          ).all());
      return json({ ok: true, years: results });
    } catch (e) {
      return json({ ok: false, error: String(e && e.message || e) }, 500);
    }
  });
}
