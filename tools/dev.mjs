/**
 * 로컬 개발 서버 — 상세 화면의 케이스·카트리지 모션을 손보며 바로 확인하는 용도.
 *
 *   node tools/dev.mjs            http://localhost:8788
 *   node tools/dev.mjs 3000       포트 지정
 *   node tools/dev.mjs --offline  받아오지 않고 캐시만 쓴다
 *
 * 하는 일
 *   1. docs/ 를 그대로 서빙한다(브라우저 캐시는 끈다 — 고치고 새로고침하면 바로 보이게).
 *   2. /api/*  → 운영 API 로 받아 와 .devcache/api 에 저장. 다음부터는 캐시에서 준다.
 *   3. /pub/*  → 미디어 워커로 받아 온다. 이때 Referer 를 evegoodretro.com 으로 붙인다 —
 *      WAF 의 핫링크 가드가 localhost 를 남의 사이트로 보고 막기 때문이다.
 *   4. /thumb/* → 목록 썸네일(r2.dev).
 *   5. /dev     → 케이스 모양별 표본을 모아 둔 시작 페이지.
 *
 * 한 번 받아 두면 인터넷 없이도 돌아간다. 외부에서 못 받으면 캐시로 대신한다.
 * 의존성 없음(Node 18+ 의 fetch 사용).
 */
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = path.join(ROOT, 'docs');
const CACHE = path.join(ROOT, '.devcache');

const args = process.argv.slice(2);
const OFFLINE = args.includes('--offline');
const PORT = Number(args.find((a) => /^\d+$/.test(a))) || 8788;

const UP = {
  api: 'https://evegoodretro.com',
  pub: 'https://media.evegoodretro.com',
  thumb: 'https://pub-ce7fb67413a8472b9d565037b8fbd5ef.r2.dev',
};

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.pdf': 'application/pdf',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
};
const mime = (p) => MIME[path.extname(p).toLowerCase()] || 'application/octet-stream';

/** 케이스 모양별 표본 — 모션을 고칠 때 이 네 가지는 매번 확인해야 한다.
 *  가로/세로는 기종이 아니라 그 판본 box3d 그림의 비율로 갈린다(가로 > 세로 x 1.05).
 *  같은 기종이라도 판본에 따라 달라지므로, 아래는 실제 화면에서 확인한 것만 적었다. */
const SAMPLES = [
  ['가로 케이스 (wide) — 카트리지가 아래로 내려간다', [
    ['n64', 5456, '듀크 뉴켐: 제로 아워'],
    ['n64', 5504, '겍스 3: 딥 커버 게코'],
    ['n64', 5513, '파이팅 포스 64'],
    ['sfc', 2448, '페이지마스터'],
  ]],
  ['세로 케이스 + 카트리지 — 오른쪽에 겹친다', [
    ['sfc', 2169, '슈퍼 동키콩 2'],
    ['gba', 4132, '톰과 제리 테일즈'],
    ['psp', 28665, '슈퍼로봇대전 마장기신 II'],
    ['nds', 85826, '하야테처럼! 학교편'],
  ]],
  ['세로 케이스 + 디스크', [
    ['psx', 20138, '랠리 크로스'],
    ['psx', 19759, '아크 더 래드'],
    ['pcfx', 38424, '배틀 히트'],
  ]],
  ['영상만 (카트리지 이미지 없음) — 작은 영상 조각', [
    ['amiga', 33802, '아크틱폭스'],
    ['amiga', 102508, '에일리언 브리드 3D 2'],
  ]],
];

const esc = (s) => String(s).replace(/[&<>"]/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function devPage() {
  const groups = SAMPLES.map(([title, list]) => `
    <section>
      <h2>${esc(title)}</h2>
      <ul>${list.map(([sys, id, name]) => `
        <li><a href="/games/game.html?sys=${sys}&amp;id=${id}">${esc(name)}</a>
            <span>${sys} · ${id}</span></li>`).join('')}
      </ul>
    </section>`).join('');
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8" />
<title>모션 테스트 — 표본</title>
<style>
 body{margin:0;padding:34px;background:#0a0c14;color:#e8ebf2;
   font:15px/1.6 system-ui,-apple-system,'Segoe UI',sans-serif}
 h1{font-size:20px;margin:0 0 6px} p.m{color:#9aa1b6;font-size:13.5px;margin:0 0 26px}
 section{margin-bottom:24px}
 h2{font-size:14px;color:#22d3ee;margin:0 0 8px;letter-spacing:.02em}
 ul{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:8px}
 li{background:#12141c;border:1px solid #2a2e3d;border-radius:11px;padding:10px 13px}
 a{color:#e8ebf2;text-decoration:none;font-weight:700}
 a:hover{color:#22d3ee}
 li span{display:block;color:#6b7280;font-size:11.5px;margin-top:2px}
 code{background:#12141c;border:1px solid #2a2e3d;border-radius:6px;padding:2px 6px;font-size:12.5px}
 .tip{margin-top:28px;color:#9aa1b6;font-size:13px}
</style></head><body>
<h1>케이스·카트리지 모션 테스트</h1>
<p class="m">고칠 곳 — 모양과 전환은 <code>docs/games/style.css</code>,
 펴기·회전 동작은 <code>docs/games/game.html</code>. 고친 뒤 새로고침하면 바로 보인다.</p>
${groups}
<p class="tip">미디어와 API 는 처음 한 번 받아 <code>.devcache/</code> 에 저장한다.
 그 뒤로는 인터넷 없이도 돌아간다(<code>node tools/dev.mjs --offline</code>).</p>
</body></html>`;
}

/** 캐시 파일 경로 — 경로 구분자와 물음표만 안전하게 바꾼다. */
function cachePath(kind, rest) {
  const safe = rest.replace(/\.\./g, '_').replace(/[?*:<>|"]/g, '_');
  return path.join(CACHE, kind, safe || 'index');
}

async function readCache(file) {
  try {
    const [buf, meta] = await Promise.all([
      fsp.readFile(file),
      fsp.readFile(file + '.type', 'utf8').catch(() => ''),
    ]);
    return { buf, type: meta || mime(file) };
  } catch { return null; }
}

async function writeCache(file, buf, type) {
  await fsp.mkdir(path.dirname(file), { recursive: true });
  await fsp.writeFile(file, buf);
  await fsp.writeFile(file + '.type', type);
}

/** 캐시 우선 → 없으면 받아 온다. 받아오기에 실패하면 캐시라도 준다. */
async function proxy(res, kind, rest, upstream) {
  const file = cachePath(kind, rest);
  const hit = await readCache(file);
  if (hit) { send(res, 200, hit.type, hit.buf, 'HIT'); return; }
  if (OFFLINE) { send(res, 504, 'text/plain; charset=utf-8', Buffer.from('캐시에 없음 (offline)')); return; }
  try {
    const r = await fetch(upstream, {
      headers: {
        // WAF 핫링크 가드가 localhost 를 막는다 — 우리 사이트에서 온 것처럼 보내야 통과한다.
        'Referer': 'https://evegoodretro.com/',
        'User-Agent': 'Mozilla/5.0 (dev.mjs)',
      },
    });
    const buf = Buffer.from(await r.arrayBuffer());
    const type = r.headers.get('content-type') || mime(rest);
    if (r.ok) await writeCache(file, buf, type);
    send(res, r.status, type, buf, r.ok ? 'MISS' : 'ERR');
  } catch (e) {
    const stale = await readCache(file);
    if (stale) { send(res, 200, stale.type, stale.buf, 'STALE'); return; }
    send(res, 502, 'text/plain; charset=utf-8', Buffer.from('받아오기 실패: ' + e.message));
  }
}

function send(res, status, type, buf, note) {
  res.writeHead(status, {
    'Content-Type': type,
    'Content-Length': buf.length,
    // 고친 것이 바로 보이도록 브라우저 캐시는 끈다
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    ...(note ? { 'X-Dev': note } : {}),
  });
  res.end(buf);
}

async function serveStatic(res, urlPath) {
  let rel = decodeURIComponent(urlPath).replace(/^\/+/, '');
  if (rel === '' ) rel = 'index.html';
  const full = path.join(DOCS, rel);
  if (!full.startsWith(DOCS)) { send(res, 403, 'text/plain', Buffer.from('403')); return; }
  let stat = await fsp.stat(full).catch(() => null);
  if (stat && stat.isDirectory()) return serveStatic(res, urlPath.replace(/\/?$/, '/') + 'index.html');
  if (!stat) {
    // 깨끗한 주소(/story → story.html)도 받아 준다
    const alt = full + '.html';
    if (await fsp.stat(alt).catch(() => null)) return sendFile(res, alt);
    send(res, 404, 'text/plain; charset=utf-8', Buffer.from('404 ' + rel));
    return;
  }
  return sendFile(res, full);
}

async function sendFile(res, full) {
  const buf = await fsp.readFile(full);
  send(res, 200, mime(full), buf);
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://localhost');
  const p = u.pathname;
  try {
    if (p === '/dev' || p === '/dev/') {
      send(res, 200, 'text/html; charset=utf-8', Buffer.from(devPage(), 'utf8'));
    } else if (p.startsWith('/api/')) {
      await proxy(res, 'api', p.slice(5) + (u.search || ''), UP.api + p + u.search);
    } else if (p.startsWith('/pub/')) {
      await proxy(res, 'media', p.slice(5), UP.pub + p);
    } else if (p.startsWith('/thumb/')) {
      await proxy(res, 'thumb', p.slice(7), UP.thumb + p.slice(6));
    } else {
      await serveStatic(res, p);
    }
  } catch (e) {
    send(res, 500, 'text/plain; charset=utf-8', Buffer.from('오류: ' + e.stack));
  }
});

/** 윈도우는 일부 포트 대역을 미리 잡아 두어 EACCES 가 난다 — 비어 있는 포트를 찾아 쓴다. */
function listen(port, left) {
  server.once('error', (e) => {
    if ((e.code === 'EACCES' || e.code === 'EADDRINUSE') && left > 0) {
      console.log('  %d 포트를 못 써서 %d 로 옮긴다 (%s)', port, port + 1, e.code);
      listen(port + 1, left - 1);
    } else {
      console.error('  서버를 열지 못했다:', e.message);
      process.exit(1);
    }
  });
  server.listen(port, '127.0.0.1', () => {
    console.log('  개발 서버  http://localhost:' + port + '/dev   (표본 목록)');
    console.log('  사이트     http://localhost:' + port + '/games/');
    console.log('  캐시       ' + path.relative(ROOT, CACHE) + (OFFLINE ? '  [offline]' : ''));
  });
}
listen(PORT, 20);
