/**
 * 엣지 캐시 도우미 — 밑줄로 시작하는 파일이라 경로로 노출되지 않는다.
 *
 * Pages Functions 응답에는 Cloudflare 가 `max-age=0, must-revalidate` 를 붙여 버려서
 * 우리가 Cache-Control 만 지정해서는 엣지에 남지 않는다. 결과적으로 방문자 한 명마다
 * D1 을 그대로 때리게 되므로, Cache API 에 직접 넣고 꺼내 쓴다.
 *
 *   return cached(context, 3600, () => json({...}));
 */
export async function cached(ctx, ttl, build) {
  const req = ctx.request;
  if (req.method !== 'GET' || ttl <= 0) return build();

  const cache = caches.default;
  const key = new Request(req.url, { method: 'GET' });
  const hit = await cache.match(key);
  if (hit) {
    const h = new Response(hit.body, hit);
    h.headers.set('X-Cache', 'HIT');
    return h;
  }

  const res = await build();
  if (res.status !== 200) return res;         // 오류는 캐시하지 않는다

  const out = new Response(res.body, res);
  out.headers.set('Cache-Control', 'public, max-age=' + ttl);
  out.headers.set('X-Cache', 'MISS');
  ctx.waitUntil(cache.put(key, out.clone()));
  return out;
}

/** 오늘 남은 시간(초). '오늘의 게임' 처럼 날짜가 바뀔 때만 달라지는 응답에 쓴다. */
export function untilNextDay() {
  const now = Date.now();
  const next = (Math.floor(now / 86400000) + 1) * 86400000;
  return Math.max(300, Math.floor((next - now) / 1000));
}

export function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
