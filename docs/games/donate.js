/**
 * 후원 모달 — 아카이브 4개 페이지가 함께 쓴다.
 * 페이지마다 마크업을 복사해 두면 문구가 갈라지므로 여기서 한 번만 만들어 붙인다.
 * 여는 버튼은 어느 페이지든 [data-donate] 만 달아 두면 된다.
 */
(function () {
  var MAIL = 'evegood99@gmail.com';
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
          '<figure><img src="../assets/donate_naver.png" alt="네이버페이 QR" loading="lazy" />' +
            '<figcaption>Naver Pay</figcaption></figure>' +
          '<figure><img src="../assets/donate_kakao.png" alt="카카오페이 QR" loading="lazy" />' +
            '<figcaption>Kakao Pay</figcaption></figure>' +
        '</div>' +
        '<p class="dm-scan">카메라 또는 페이 앱으로 QR을 스캔해 후원할 수 있어요.</p>' +
        '<div class="dm-code">' +
          '<b>후원자 코드 안내</b>' +
          '<p>후원해 주신 뒤 아래 이메일로 알려 주시면 <b>스폰서 코드</b>를 보내드립니다. ' +
            '이 코드로 해방툴 <b>1.0 클로즈드 베타</b>(데모의 시스템 2개·게임 100개 제한이 풀린 빌드)를 ' +
            '내려받을 수 있습니다.</p>' +
          '<a class="btn" href="../index.html#download">베타 다운로드로 이동 →</a>' +
        '</div>' +
        '<a class="dm-mail" href="mailto:' + MAIL + '?subject=HAE-BANG%20Donation">✉ ' + MAIL + '</a>' +
      '</div>' +
    '</div>';

  function init() {
    if (document.getElementById('dm')) return;
    document.body.insertAdjacentHTML('beforeend', HTML);
    var dm = document.getElementById('dm');

    function open(on) {
      dm.classList.toggle('open', on);
      dm.setAttribute('aria-hidden', on ? 'false' : 'true');
      // 모달이 떠 있는 동안 뒤 목록이 같이 스크롤되지 않도록 잠근다.
      document.body.style.overflow = on ? 'hidden' : '';
    }
    document.querySelectorAll('[data-donate]').forEach(function (b) {
      b.addEventListener('click', function (e) { e.preventDefault(); open(true); });
    });
    document.getElementById('dm-x').addEventListener('click', function () { open(false); });
    dm.addEventListener('click', function (e) { if (e.target === dm) open(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && dm.classList.contains('open')) open(false);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
