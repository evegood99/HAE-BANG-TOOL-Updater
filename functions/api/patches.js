/**
 * GET /api/patches — 대한글화시대(KR_PATCH_AGES) 한글화 패치 목록
 *
 * 목록의 정본은 저장소 README 의 '게임 목록' 표다. 홈페이지에 목록을 또 적어 두면
 * 패치를 올릴 때마다 두 곳을 고쳐야 하므로, README 를 읽어 그대로 쓴다.
 * 버전·상태·스크린샷은 표에서, 내려받기 수와 파일 정보는 Releases API 에서 가져와 합친다.
 *
 * GitHub API 는 미인증이면 IP당 시간 60회라 엣지 캐시(6시간)로 아낀다.
 * 표 형식이 바뀌어 파싱이 0건이 되면 아래 FALLBACK 으로 화면이 비지 않게 한다.
 */
const REPO = 'evegood99/KR_PATCH_AGES';
const RAW = `https://raw.githubusercontent.com/${REPO}/main`;
// 저장소를 고치면 곧 반영되어야 해서 짧게 잡는다(10분).
// GitHub API 는 미인증이면 IP당 시간 60회인데, 한 번 새로 받을 때 3회(README·릴리스·파일목록)
// 이므로 시간당 18회 — 여유가 있다.
const TTL = 600;

// README 표 한 줄:
// | [<img src="경로" width="240"><br>**제목**](폴더/) | 시스템 | 버전 | 상태 | [Release](주소) |
const ROW = /^\|\s*\[<img\s+src="([^"]+)"[^>]*>\s*<br\s*\/?>\s*\*\*(.+?)\*\*\]\(([^)]+)\)\s*\|([^|]*)\|([^|]*)\|([^|]*)\|(.*)\|\s*$/;
const TAG = /releases\/tag\/([^)\s]+)/;

// 파싱이 실패해도 최소한 이만큼은 보이게 한다(2026-08 기준 스냅샷).
const FALLBACK = [
  { title: '버밀리온 (Vermilion)', system: '메가드라이브', version: 'v0.9', status: '테스트 중',
    path: 'md/vermilion/', shot: 'md/vermilion/screenshots/title.png', tag: 'vermilion-v0.9' },
  { title: '존의 사생활', system: 'DOS', version: 'v0.9', status: '1차 검수 완료',
    path: 'dos/jones-in-the-fastlane/', shot: 'dos/jones-in-the-fastlane/screenshots/start_ment.png',
    tag: 'jones-in-the-fastlane-v0.9' },
  { title: '슈퍼 대전략', system: '메가드라이브', version: 'v0.8', status: '검수 중',
    path: 'md/super-daisenryaku/', shot: 'md/super-daisenryaku/screenshots/title.png',
    tag: 'super-daisenryaku-v0.8' },
  { title: '항구의 트레이지아', system: '메가드라이브', version: 'v0.8', status: '검수 중',
    path: 'md/Minato-no-Traysia/', shot: 'md/Minato-no-Traysia/screenshots/title.png',
    tag: 'minato-no-traysia-v0.8' },
  { title: '마스터 오브 몬스터즈', system: '메가드라이브', version: '', status: '준비 중',
    path: 'md/master-of-monsters/', shot: 'md/master-of-monsters/screenshots/overview.png', tag: '' },
  { title: '모두의 골프 포터블 2', system: 'PSP', version: 'v0.1', status: '개발 중',
    path: 'psp/Minna-no-Golf-Portable2/', shot: 'psp/Minna-no-Golf-Portable2/screenshots/title.png', tag: '' },
];

import { cached } from './_cache.js';

export async function onRequestGet(context) {
  // ?fresh=1 — 캐시를 건너뛰고 저장소를 지금 다시 읽는다.
  // 저장소를 고친 직후 바로 확인하고 싶을 때 쓴다(평소에는 쓰지 않는다).
  const fresh = new URL(context.request.url).searchParams.get('fresh') === '1';
  return fresh ? build(true) : cached(context, 300, () => build(false));
}

async function build(fresh) {
  try {
    const [md, releases, tree] = await Promise.all([
      getReadme(fresh), getReleases(fresh), getTree(fresh),
    ]);
    const shotsBy = groupShots(tree);
    let items = parseTable(md);
    const parsed = items.length > 0;
    if (!parsed) items = FALLBACK.slice();

    const byTag = new Map(releases.map((r) => [String(r.tag_name).toLowerCase(), r]));
    const games = items.map((it) => {
      const rel = it.tag ? byTag.get(it.tag.toLowerCase()) : null;
      const asset = rel && (rel.assets || [])[0];
      // 게임 폴더의 screenshots/ 전체. 카드에 쓰는 대표 이미지를 맨 앞에 둔다.
      const dir = trimSlash(it.path);
      const all = shotsBy.get(dir) || [];
      const main = trimSlash(it.shot || '');
      const ordered = main && all.indexOf(main) >= 0
        ? [main].concat(all.filter(function (x) { return x !== main; }))
        : all;
      return {
        title: it.title,
        system: it.system,
        version: it.version || (rel ? tagVersion(rel.tag_name) : ''),
        status: it.status,
        repoUrl: `https://github.com/${REPO}/tree/main/${trimSlash(it.path)}`,
        shot: it.shot ? `${RAW}/${encodePath(it.shot)}` : null,
        shots: ordered.map((x) => `${RAW}/${encodePath(x)}`),
        release: rel ? `https://github.com/${REPO}/releases/tag/${rel.tag_name}` : null,
        download: asset ? asset.browser_download_url : null,
        file: asset ? asset.name : null,
        size: asset ? asset.size : null,
        downloads: rel ? (rel.assets || []).reduce((a, x) => a + (x.download_count || 0), 0) : 0,
        date: rel ? String(rel.published_at || '').slice(0, 10) : null,
      };
    });

    return json({
      ok: true, parsed, repo: `https://github.com/${REPO}`,
      total: games.length,
      downloads: games.reduce((a, g) => a + g.downloads, 0),
      released: games.filter((g) => g.download).length,
      games,
    }, 300);
  } catch (e) {
    return json({ ok: false, error: String(e && e.message || e) }, 0, 500);
  }
}

async function getReadme(fresh) {
  const r = await gh(`${RAW}/README.md`, fresh);
  return r.ok ? await r.text() : '';
}

async function getReleases(fresh) {
  const r = await gh(`https://api.github.com/repos/${REPO}/releases?per_page=100`, fresh);
  if (!r.ok) return [];
  const v = await r.json();
  return Array.isArray(v) ? v : [];
}

/** 저장소 전체 파일 목록 — 게임마다 폴더를 조회하면 6번 부를 것을 한 번에 끝낸다. */
async function getTree(fresh) {
  const r = await gh(`https://api.github.com/repos/${REPO}/git/trees/main?recursive=1`, fresh);
  if (!r.ok) return [];
  const j = await r.json();
  return Array.isArray(j.tree) ? j.tree : [];
}

const IMG = /\.(png|jpe?g|gif|webp)$/i;
/** '<게임폴더>/screenshots/<파일>' 을 게임 폴더별로 묶는다. */
function groupShots(tree) {
  const m = new Map();
  for (const t of tree) {
    if (t.type !== 'blob' || !IMG.test(t.path)) continue;
    const i = t.path.indexOf('/screenshots/');
    if (i < 0) continue;
    const dir = t.path.slice(0, i);
    if (!m.has(dir)) m.set(dir, []);
    m.get(dir).push(t.path);
  }
  for (const v of m.values()) v.sort();
  return m;
}

function gh(url, fresh) {
  // 캐시는 요청 URL 로 구분된다. cacheTtl 만 줄이면 이미 저장된 항목은 남은 시간만큼
  // 그대로 쓰여서(6시간짜리가 남아 있었다) 저장소를 고쳐도 반영이 늦다.
  // 그래서 주소에 10분 단위 번호를 붙여, 10분마다 새 주소 = 새로 받기가 되게 한다.
  const bucket = fresh ? Date.now() : Math.floor(Date.now() / (TTL * 1000));
  const u = url + (url.indexOf('?') < 0 ? '?' : '&') + '_=' + bucket;
  return fetch(u, {
    headers: { 'User-Agent': 'haebang-homepage', Accept: 'application/vnd.github+json' },
    cf: { cacheTtl: fresh ? 0 : TTL, cacheEverything: !fresh },
  });
}

/** README '게임 목록' 표에서 행을 뽑는다. 표가 없거나 형식이 바뀌면 빈 배열. */
function parseTable(md) {
  const out = [];
  for (const line of String(md).split('\n')) {
    const m = ROW.exec(line.trim());
    if (!m) continue;
    const dl = m[7] || '';
    const tag = (TAG.exec(dl) || [])[1] || '';
    out.push({
      shot: m[1].trim(), title: m[2].trim(), path: m[3].trim(),
      system: clean(m[4]), version: clean(m[5]), status: clean(m[6]), tag,
    });
  }
  return out;
}

// 상태 칸의 이모지(🔍 📋 🚧)는 화면에서 색 배지로 대신하므로 떼어 낸다.
const clean = (s) => String(s || '').replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}️]/gu, '').trim();
const trimSlash = (s) => String(s || '').replace(/^\/+|\/+$/g, '');
const encodePath = (p) => String(p).split('/').map(encodeURIComponent).join('/');
const tagVersion = (t) => (String(t).match(/(v[\d.]+)$/) || [])[1] || '';

function json(obj, maxAge = 0, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': maxAge ? `public, max-age=${maxAge}` : 'no-store',
    },
  });
}
