/**
 * 후원 — 버튼과 모달을 여기서 한 번만 만들어 모든 페이지에 붙인다.
 *
 * 예전에는 홈(하단 푸터, 간단한 안내)과 아카이브(서브바, 자세한 안내)가 서로
 * 다른 마크업·문구를 갖고 있었다. 문구를 고칠 때마다 갈라지므로 하나로 합친다.
 *
 * 버튼은 헤더의 다운로드 왼쪽에 놓는다. 별도로 [data-donate] 를 달아 둔 곳
 * (홈 푸터 등)도 같은 모달을 연다.
 * 스타일은 #dm 으로 좁혀서 넣는다 — 홈의 스폰서 모달(#sponModal)이 같은 .dm
 * 클래스를 쓰고 있어, 좁히지 않으면 그쪽 모양까지 바뀐다.
 */
(function () {
  // 루트 기준 절대경로를 쓴다. 상대경로는 폴더 깊이를 세야 하는데, 깨끗한 주소
  // (/story = story.html)와 하위 폴더(/games/ /patches/)를 구분할 방법이 없다.
  var P = '/';
  // 후원 알림은 mailto 대신 문의 발송 경로(/api/contact 워커)로 보낸다.
  var TS_SITEKEY = '0x4AAAAAAEJ-dMWHvMfvuco0';   // Turnstile 공개 사이트키

  var CSS =
    // 다운로드가 주 버튼이라 후원은 한 단계 작게 둔다
    '.btn-donate{display:inline-flex; align-items:center; gap:5px; padding:6px 11px;' +
      'border-radius:9px; border:1px solid rgba(244,63,94,.45); color:#ffd7de;' +
      'font-family:inherit; font-size:12.5px; font-weight:700; cursor:pointer; white-space:nowrap;' +
      'background:linear-gradient(120deg,rgba(244,63,94,.22),rgba(244,63,94,.10)); transition:.18s}' +
    '.btn-donate:hover{border-color:#fb7185; color:#fff;' +
      'background:linear-gradient(120deg,rgba(244,63,94,.34),rgba(244,63,94,.18))}' +
    '#dm{position:fixed; inset:0; z-index:210; display:flex; align-items:center; justify-content:center;' +
      'padding:24px; background:rgba(4,5,10,.86); backdrop-filter:blur(6px);' +
      'opacity:0; pointer-events:none; transition:.2s}' +
    '#dm.open{opacity:1; pointer-events:auto}' +
    '#dm .dm-card{width:480px; max-width:94vw; max-height:92vh; overflow:auto;' +
      'background:var(--surface,#12141c); border:1px solid var(--border2,#2a2e3d); border-radius:16px;' +
      'padding:22px 24px 20px; box-shadow:0 30px 80px rgba(0,0,0,.6);' +
      'transform:translateY(10px); transition:.2s}' +
    '#dm.open .dm-card{transform:none}' +
    '#dm .dm-head{display:flex; align-items:center; justify-content:space-between; margin-bottom:12px}' +
    '#dm .dm-head h3{margin:0; font-size:18px; font-weight:800; color:var(--text,#e8ebf2)}' +
    '#dm .dm-x{background:none; border:0; color:var(--faint,#6b7280); font-size:26px; line-height:1;' +
      'cursor:pointer; transition:.15s; font-family:inherit}' +
    '#dm .dm-x:hover{color:var(--text,#e8ebf2)}' +
    '#dm .dm-desc{font-size:13.5px; line-height:1.6; color:var(--muted,#9aa1b6); margin:0 0 12px}' +
    '#dm .dm-use{list-style:none; margin:0 0 18px; padding:0; display:flex; flex-direction:column; gap:10px}' +
    '#dm .dm-use li{border:1px solid var(--border,#232734); border-radius:12px;' +
      'background:var(--surface2,#181b25); padding:11px 13px}' +
    '#dm .dm-use b{display:block; font-size:13.5px; color:var(--text,#e8ebf2); margin-bottom:3px}' +
    '#dm .dm-use span{display:block; font-size:12.5px; line-height:1.6; color:var(--muted,#9aa1b6)}' +
    '#dm .dm-qr{display:flex; gap:14px; justify-content:center; margin:4px 0 2px}' +
    '#dm .dm-qr figure{margin:0; display:flex; flex-direction:column; align-items:center; gap:8px}' +
    '#dm .dm-qr img{width:100%; max-width:186px; height:auto; max-height:262px; object-fit:contain;' +
      'border-radius:10px; background:#fff; padding:6px}' +
    '#dm .dm-qr figcaption{font-size:12.5px; font-weight:700; color:var(--muted,#9aa1b6)}' +
    '#dm .dm-scan{font-size:12px; color:var(--faint,#6b7280); text-align:center; margin:14px 0 4px}' +
    '#dm .dm-code{margin:16px 0 6px; padding:13px 14px; border-radius:12px;' +
      'border:1px solid rgba(34,211,238,.28); background:rgba(34,211,238,.07)}' +
    '#dm .dm-code > b{display:block; font-size:13px; color:var(--cyan,#22d3ee); margin-bottom:6px}' +
    '#dm .dm-code p{margin:0 0 11px; font-size:12.5px; line-height:1.7; color:var(--muted,#9aa1b6)}' +
    '#dm .dm-code p b{color:var(--text,#e8ebf2)}' +
    '#dm .dm-code .btn{display:inline-flex; align-items:center; padding:8px 14px; border-radius:10px;' +
      'border:1px solid var(--border2,#2a2e3d); color:var(--text,#e8ebf2); font-size:13px; font-weight:700}' +
    '#dm .dm-mail{display:block; text-align:center; font-size:14px; font-weight:700;' +
      'color:var(--cyan,#22d3ee); margin-top:12px}' +
    '#dm .dm-mail:hover{text-decoration:underline}' +
    // 후원 알리기 폼 (mailto 대체 — /api/contact 로 자동 발송)
    '#dm .dm-form{margin-top:16px; border-top:1px solid var(--border,#232734); padding-top:14px}' +
    '#dm .dm-form > b{display:block; font-size:13px; color:var(--text,#e8ebf2); margin-bottom:9px}' +
    '#dm .dm-row{display:grid; grid-template-columns:1fr 1fr; gap:8px}' +
    '@media (max-width:430px){ #dm .dm-row{grid-template-columns:1fr} }' +
    '#dm .dm-in{width:100%; font-family:inherit; font-size:13px; color:var(--text,#e8ebf2);' +
      'background:var(--bg2,#0a0c14); border:1px solid var(--border2,#2a2e3d); border-radius:9px;' +
      'padding:9px 11px; outline:none; margin-bottom:8px; box-sizing:border-box}' +
    '#dm .dm-in:focus{border-color:var(--cyan,#22d3ee)}' +
    '#dm textarea.dm-in{min-height:60px; resize:vertical}' +
    '#dm .dm-send{display:inline-flex; align-items:center; gap:6px; font-size:13.5px; font-weight:800;' +
      'color:#05070d; background:linear-gradient(120deg,#22d3ee,#6366f1); border:0; border-radius:10px;' +
      'padding:10px 16px; cursor:pointer; font-family:inherit}' +
    '#dm .dm-send[disabled]{opacity:.55; cursor:not-allowed}' +
    '#dm .dm-form-foot{display:flex; align-items:center; justify-content:space-between; gap:10px;' +
      'flex-wrap:wrap; margin-top:2px}' +
    '#dm .dm-status{font-size:12.5px; min-height:16px; margin:8px 0 0}' +
    '#dm .dm-status.ok{color:#6ee7b7}' +
    '#dm .dm-status.err{color:#fb7185}' +
    // 이 버튼이 늘면서 헤더가 좁은 화면에서 넘쳤다 — 여기서 같이 줄인다.
    // (페이지 쪽 CSS 에 두면 이 주입 CSS 가 뒤에 와서 덮어 버린다)
    // 다운로드는 접는다. .hide-s 규칙이 홈에만 있고 소식·가이드·읽을거리엔
    // 아예 없어서 페이지마다 달랐다 — 여기서 한 번에 맞춘다.
    '@media (max-width:560px){ .nav-right .btn-primary{display:none} }' +
    '@media (max-width:400px){' +
      '.brand .bs{display:none}' +
      '.nav{gap:8px}' +
      '.btn-donate{padding:5px 9px; font-size:12px}' +
    '}' +
    // 아주 작은 화면(320px 급)에서는 로고 글씨를 접고 아이콘만 남긴다
    '@media (max-width:350px){ .brand > span{display:none} }';

  var HTML =
    '<div class="dm" id="dm" aria-hidden="true">' +
      '<div class="dm-card" role="dialog" aria-modal="true" aria-label="후원하기">' +
        '<div class="dm-head">' +
          '<h3>후원하기 ♥</h3>' +
          '<button class="dm-x" id="dm-x" aria-label="닫기">&times;</button>' +
        '</div>' +
        '<p class="dm-desc">보내 주신 후원금은 아래 세 가지에 쓰입니다.</p>' +
        '<ul class="dm-use">' +
          '<li><b>게임 아카이브 운영</b><span>7만여 개 게임의 자료를 담아 두고 전송하는 데 드는 ' +
            '데이터베이스·이미지 저장 비용입니다.</span></li>' +
          '<li><b>한글화 패치 토큰 지원</b><span>대한글화시대의 번역 작업에 드는 AI 토큰 비용에 씁니다. ' +
            '후원이 늘수록 더 많은 게임을 한글로 옮길 수 있습니다.</span></li>' +
          '<li><b>해방툴 개발</b><span>기능 추가와 유지보수, 그리고 메타데이터를 계속 채워 나가는 데 씁니다.</span></li>' +
        '</ul>' +
        '<div class="dm-qr">' +
          '<figure><img src="' + P + 'assets/donate_naver.png" alt="네이버페이 QR" loading="lazy" />' +
            '<figcaption>Naver Pay</figcaption></figure>' +
          '<figure><img src="' + P + 'assets/donate_kakao.png" alt="카카오페이 QR" loading="lazy" />' +
            '<figcaption>Kakao Pay</figcaption></figure>' +
        '</div>' +
        '<p class="dm-scan">카메라 또는 페이 앱으로 QR을 스캔해 후원할 수 있어요.</p>' +
        '<div class="dm-code">' +
          '<b>후원자 코드 안내</b>' +
          '<p>후원해 주신 뒤 아래 폼으로 알려 주시면 <b>스폰서 코드</b>를 보내드립니다. ' +
            '이 코드로 해방툴 <b>프로그램 사전 다운로드</b> 및 <b>마이너 신규 베타 버전 다운로드</b>의 ' +
            '혜택을 제공하고 있습니다.</p>' +
          '<a class="btn" href="' + P + 'haebang.html#download">베타 다운로드로 이동 →</a>' +
        '</div>' +
        '<form class="dm-form" id="dm-form" autocomplete="off" novalidate>' +
          '<b>✉ 후원 알리기 — 이메일을 남기시면 스폰서 코드를 보내드립니다</b>' +
          '<div class="dm-row">' +
            '<input class="dm-in" id="dm-name" type="text" maxlength="100" placeholder="이름 (닉네임)" />' +
            '<input class="dm-in" id="dm-email" type="email" maxlength="200" placeholder="회신 받을 이메일" />' +
          '</div>' +
          '<textarea class="dm-in" id="dm-msg" maxlength="2000" placeholder="남길 내용 (선택) — 후원 수단·시각, 궁금한 점 등"></textarea>' +
          '<input name="website" type="text" tabindex="-1" autocomplete="off" aria-hidden="true" ' +
            'style="position:absolute; left:-9999px; top:-9999px; width:1px; height:1px; opacity:0" />' +
          '<div class="dm-form-foot">' +
            '<div id="dm-ts"></div>' +
            '<button class="dm-send" id="dm-send" type="submit">보내기 ✉</button>' +
          '</div>' +
          '<p class="dm-status" id="dm-status" role="status" aria-live="polite"></p>' +
        '</form>' +
      '</div>' +
    '</div>';

  function init() {
    if (document.getElementById('dm')) return;

    var st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);

    // 헤더의 다운로드 왼쪽에 버튼을 놓는다.
    var right = document.querySelector('.nav-right');
    if (right && !right.querySelector('[data-donate]')) {
      var b = document.createElement('button');
      b.className = 'btn-donate';
      b.setAttribute('data-donate', '');
      b.setAttribute('data-ko', '♥ 후원');      // 홈·소식·가이드의 언어 전환이 읽는다
      b.setAttribute('data-en', '♥ Donate');
      b.textContent = document.documentElement.lang === 'en' ? '♥ Donate' : '♥ 후원';
      var dl = right.querySelector('.btn-primary');
      if (dl) right.insertBefore(b, dl); else right.appendChild(b);
    }

    document.body.insertAdjacentHTML('beforeend', HTML);
    var dm = document.getElementById('dm');

    // ── Turnstile — 모달을 처음 열 때만 로드/렌더한다 (모든 페이지에 미리 싣지 않기) ──
    var tsId = null, tsLoading = false;
    function mountTs() {
      if (tsId !== null) return;
      if (window.turnstile) {
        try { tsId = window.turnstile.render('#dm-ts', { sitekey: TS_SITEKEY, theme: 'dark' }); } catch (e) {}
        return;
      }
      if (tsLoading) return;
      tsLoading = true;
      window.__dmTsReady = function () { tsLoading = false; mountTs(); };
      var s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=__dmTsReady&render=explicit';
      s.async = true;
      document.head.appendChild(s);
    }

    function open(on) {
      dm.classList.toggle('open', on);
      dm.setAttribute('aria-hidden', on ? 'false' : 'true');
      // 모달이 떠 있는 동안 뒤 목록이 같이 스크롤되지 않도록 잠근다.
      document.body.style.overflow = on ? 'hidden' : '';
      if (on) mountTs();
    }

    // ── 후원 알리기 폼 — /api/contact 워커로 발송 (mailto 대체) ──
    var f = document.getElementById('dm-form');
    if (f) f.addEventListener('submit', function (e) {
      e.preventDefault();
      var stt = document.getElementById('dm-status');
      var btn = document.getElementById('dm-send');
      function say(m, c) { stt.textContent = m || ''; stt.className = 'dm-status' + (c ? ' ' + c : ''); }
      var name = document.getElementById('dm-name').value.trim();
      var email = document.getElementById('dm-email').value.trim();
      var msg = document.getElementById('dm-msg').value.trim() ||
        '(내용 없음) 후원 알림입니다 — 스폰서 코드 부탁드립니다.';
      if (!name || !email) { say('이름과 이메일을 채워 주세요.', 'err'); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { say('이메일 주소를 확인해 주세요.', 'err'); return; }
      var tk = '';
      try { tk = (window.turnstile && tsId !== null) ? window.turnstile.getResponse(tsId) : ''; } catch (err) {}
      if (!tk) { say('로봇이 아님을 확인해 주세요.', 'err'); return; }
      btn.disabled = true;
      say('보내는 중…');
      fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'donate', name: name, email: email, message: msg,
          turnstile: tk, website: f.website.value }),
      }).then(function (r) { return r.json().catch(function () { return { ok: false }; }); })
      .then(function (d) {
        btn.disabled = false;
        if (d && d.ok) {
          say('전달했습니다! 확인 후 스폰서 코드를 이메일로 보내드릴게요. 감사합니다 ♥', 'ok');
          f.reset();
          try { window.turnstile.reset(tsId); } catch (err) {}
        } else {
          say('전송에 실패했습니다. 잠시 후 다시 시도해 주세요.', 'err');
        }
      }).catch(function () {
        btn.disabled = false;
        say('서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.', 'err');
      });
    });
    document.querySelectorAll('[data-donate]').forEach(function (b) {
      b.addEventListener('click', function (e) { e.preventDefault(); open(true); });
    });
    document.getElementById('dm-x').addEventListener('click', function () { open(false); });
    dm.addEventListener('click', function (e) { if (e.target === dm) open(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && dm.classList.contains('open')) open(false);
    });

    // 해방툴(앱)의 후원 창에서 '홈페이지에서 후원 알리기'로 넘어온 경우 바로 열어 준다.
    // 앱은 로컬 WebView 라 Turnstile 위젯을 띄울 수 없어, 알리는 폼은 이쪽에서 받는다.
    if (/[?&]donate=1(?:&|$)/.test(location.search) || location.hash === '#donate') {
      open(true);
      // 후원 자체보다 '알리기'가 목적이라 폼이 보이는 자리까지 내려 준다.
      setTimeout(function () {
        var f = document.getElementById('dm-form');
        if (f && f.scrollIntoView) f.scrollIntoView({ block: 'center' });
      }, 60);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
