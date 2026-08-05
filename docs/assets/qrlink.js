/**
 * 후원 QR 을 눌러서 바로 결제로 — 모바일에서만.
 *
 * QR 은 다른 기기로 찍으라고 있는 것이라, 정작 폰으로 보고 있으면 찍을 방법이 없다.
 * 그래서 터치 기기에서는 QR 자체를 결제 링크로 만든다.
 * PC 에서는 그대로 둔다 — 눌러도 결제 앱이 없어 빈 화면만 뜬다.
 *
 * 홈(인라인 #donateModal)과 아카이브(donate.js 가 나중에 붙이는 모달) 양쪽에 걸리도록
 * 처음 한 번 훑고, 이후 body 에 새로 붙는 것도 지켜본다.
 */
(function () {
  var mq = window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)');
  if (!mq || !mq.matches) return;

  // 파일 이름 → 그 QR 에 담겨 있는 주소(이미지에서 디코딩한 값 그대로)
  var LINK = {
    donate_naver: 'https://pay.naver.com/remit/qr/inflow?v=1&a=3333270641867&c=090&d=764e54e283f9cb11b64380a7f133660a',
    donate_kakao: 'https://qr.kakaopay.com/281006011123213280001293'
  };
  var KO = '눌러서 바로 결제 →', EN = 'Tap to pay →';

  var css = document.createElement('style');
  css.textContent =
    '.dm-qr figure a.qrgo{display:block; position:relative; border-radius:10px}' +
    '.dm-qr figure a.qrgo:active{transform:scale(.97); transition:transform .1s}' +
    '.dm-qr figure a.qrgo .qrgo-tip{position:absolute; left:50%; bottom:6px; transform:translateX(-50%);' +
      'background:rgba(10,12,20,.9); border:1px solid rgba(255,255,255,.3); color:#fff;' +
      'border-radius:999px; padding:4px 10px; font-size:11px; font-weight:700; white-space:nowrap;' +
      'pointer-events:none}';
  document.head.appendChild(css);

  function apply() {
    var figs = document.querySelectorAll('.dm-qr figure');
    for (var i = 0; i < figs.length; i++) {
      var fig = figs[i];
      if (fig.querySelector('a.qrgo')) continue;              // 이미 걸었다
      var img = fig.querySelector('img');
      if (!img) continue;
      var key = (img.getAttribute('src') || '').split('/').pop().replace(/\.[a-z]+$/i, '');
      var url = LINK[key];
      if (!url) continue;

      var a = document.createElement('a');
      a.className = 'qrgo';
      a.href = url;                                            // 같은 탭 — 인앱 브라우저에서 새 탭이 막히는 경우가 있다
      a.setAttribute('aria-label', '결제 화면 열기');
      img.parentNode.insertBefore(a, img);
      a.appendChild(img);

      var tip = document.createElement('span');
      tip.className = 'qrgo-tip';
      tip.setAttribute('data-ko', KO);                         // 홈의 언어 전환이 이 속성을 읽는다
      tip.setAttribute('data-en', EN);
      tip.textContent = document.documentElement.lang === 'en' ? EN : KO;
      a.appendChild(tip);
    }
  }

  function start() {
    apply();
    if (window.MutationObserver && document.body) {
      new MutationObserver(apply).observe(document.body, { childList: true });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
