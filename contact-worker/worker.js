/**
 * 문의(Contact Us) 접수 — 홈 하단 폼에서 POST /api/contact 로 받아 이메일로 전달.
 *
 *   {name, email, message, turnstile, website(허니팟)}
 *     → Turnstile 서버 검증 → EMAIL 바인딩으로 contact@evegoodretro.com 발신,
 *       evegood99@gmail.com 수신. Reply-To 가 방문자 주소라서 받은 메일에서
 *       '답장'을 누르면 방문자에게 바로 회신된다.
 *
 * 시크릿: TURNSTILE_SECRET (Turnstile 비밀 키)
 * 스팸 방어 3겹: Turnstile 필수 검증 + 허니팟 필드 + 길이 제한.
 */

const FROM = { email: 'contact@evegoodretro.com', name: 'HAE-BANG RETRO Contact' };
const TO = 'evegood99@gmail.com';
const MAX_MSG = 5000;

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);

    let body;
    try { body = await request.json(); } catch (e) { return json({ ok: false, error: 'bad_request' }, 400); }

    // 허니팟 — 사람 눈에는 안 보이는 필드. 봇이 채우면 성공한 척 버린다.
    if (body.website) return json({ ok: true });

    const name = String(body.name || '').trim().slice(0, 100);
    const email = String(body.email || '').trim().slice(0, 200);
    const message = String(body.message || '').trim();
    const token = String(body.turnstile || '');

    if (!name || !message) return json({ ok: false, error: 'missing_fields' }, 400);
    if (message.length > MAX_MSG) return json({ ok: false, error: 'too_long' }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ ok: false, error: 'bad_email' }, 400);
    if (!token) return json({ ok: false, error: 'no_captcha' }, 400);

    // ── Turnstile 서버 검증 (클라이언트 토큰은 신뢰하지 않는다) ──
    const ip = request.headers.get('CF-Connecting-IP') || '';
    const ver = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: env.TURNSTILE_SECRET, response: token, remoteip: ip }),
    }).then((r) => r.json()).catch(() => null);
    if (!ver || !ver.success) return json({ ok: false, error: 'captcha_failed' }, 403);

    // ── 이메일 발송 (send_email 바인딩 — 토큰 불필요) ──
    // kind: 'donate' 는 후원 모달의 '후원 알리기', 그 외는 일반 문의
    const kindLabel = body.kind === 'donate' ? '후원 알림' : '문의';
    const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const text =
      '종류: ' + kindLabel + '\n' +
      '보낸 사람: ' + name + ' <' + email + '>\n' +
      'IP: ' + ip + '\n' +
      '----------------------------------------\n\n' + message;
    const html =
      '<p><b>종류:</b> ' + kindLabel + '<br>' +
      '<b>보낸 사람:</b> ' + esc(name) + ' &lt;' + esc(email) + '&gt;<br>' +
      '<b>IP:</b> ' + esc(ip) + '</p><hr>' +
      '<p style="white-space:pre-wrap">' + esc(message) + '</p>';

    try {
      await env.EMAIL.send({
        to: TO,
        from: FROM,
        replyTo: { email: email, name: name },
        subject: '[HAE-BANG RETRO ' + kindLabel + '] ' + name,
        text: text,
        html: html,
      });
    } catch (e) {
      // 원인은 로그로만 남기고 클라이언트에는 일반 오류만 준다
      console.log('contact send failed:', e && e.message);
      return json({ ok: false, error: 'send_failed' }, 502);
    }
    return json({ ok: true });
  },
};
