// 用无头 Chromium 加载插件，打开真实 arXiv 页面检查徽标。不弹窗。
// 运行：node test/e2e.mjs
// 可选环境变量：PLAYWRIGHT_CORE（playwright-core 目录）、CHROME_PATH（Chrome for Testing 可执行文件）、OUT_DIR（截图目录）
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const EXT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = process.env.OUT_DIR || path.join(os.tmpdir(), 'arxiv-citations-e2e');
const OPENALEX = 'https://api.openalex.org/**';
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-expose-headers': 'Retry-After, X-RateLimit-Limit-USD, X-RateLimit-Remaining-USD',
  'content-type': 'application/json',
};
// 解压加载的插件，ID 由目录绝对路径的 sha256 前 32 位换成 a-p 得到
const EXT_ID = [...crypto.createHash('sha256').update(fs.realpathSync(EXT)).digest('hex').slice(0, 32)]
  .map(c => String.fromCharCode(97 + parseInt(c, 16))).join('');
const OPTIONS = `chrome-extension://${EXT_ID}/options.html`;

function findPlaywright() {
  const root = path.join(os.homedir(), '.npm/_npx');
  const hits = fs.readdirSync(root)
    .map(d => path.join(root, d, 'node_modules/playwright-core'))
    .filter(p => fs.existsSync(p));
  if (!hits.length) throw new Error('没找到 playwright-core，请设置 PLAYWRIGHT_CORE');
  return hits.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
}

function findChrome() {
  const root = path.join(os.homedir(), 'Library/Caches/ms-playwright');
  const hits = fs.readdirSync(root)
    .filter(d => /^chromium-\d+$/.test(d))
    .map(d => path.join(root, d, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'))
    .filter(p => fs.existsSync(p));
  if (!hits.length) throw new Error('没找到 Chrome for Testing，请设置 CHROME_PATH');
  return hits.sort().at(-1);
}

const { chromium } = require(process.env.PLAYWRIGHT_CORE || findPlaywright());
fs.mkdirSync(OUT, { recursive: true });
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'axc-profile-'));
const ctx = await chromium.launchPersistentContext(profile, {
  executablePath: process.env.CHROME_PATH || findChrome(),
  headless: true,
  viewport: { width: 1400, height: 900 },
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
});

const page = ctx.pages()[0] || await ctx.newPage();
let apiCalls = 0;
page.on('request', r => { if (r.url().startsWith('https://api.openalex.org/')) apiCalls++; });

const readBadge = () => page.locator('h1.title > a.axc-badge').evaluate(a => ({ text: a.textContent, cls: a.className, href: a.href, title: a.title }));
const shot = name => page.locator('h1.title').screenshot({ path: path.join(OUT, `${name}.png`) });

// 等到徽标不再是「查询中」也不再是「查找其他版本」；搜索限流重试最多等 60 秒，所以给足时间
async function badge(id, { reload = false } = {}) {
  apiCalls = 0;
  if (reload) await page.reload();
  else await page.goto(`https://arxiv.org/abs/${id}`, { waitUntil: 'domcontentloaded' });
  await page.locator('h1.title > a.axc-badge').waitFor({ timeout: 30000 });
  await page.waitForFunction(() => {
    const c = document.querySelector('.axc-badge').classList;
    return !c.contains('axc-loading') && !c.contains('axc-merging');
  }, null, { timeout: 120000 });
  const info = await readBadge();
  await shot(`${id}${reload ? '-reload' : ''}`);
  return { ...info, apiCalls };
}

const results = [];
function check(name, ok, info) {
  results.push(ok);
  console.log(`${ok ? '通过' : '失败'}  ${name}`);
  console.log('      ' + JSON.stringify(info));
}

let r = await badge('2610.27465');
check('截图里那篇新论文显示数字', /^被引 \d/.test(r.text) && r.cls.includes('axc-ok'), r);

r = await badge('2610.27465', { reload: true });
check('刷新后走缓存，不再请求 OpenAlex', r.apiCalls === 0 && /^被引 \d/.test(r.text), r);

r = await badge('2611.15754');
check('曾经一直转圈的 2611.15754 显示数字', /^被引 \d/.test(r.text) && r.cls.includes('axc-ok'), r);

r = await badge('1512.03385');
check('ResNet 合并 arXiv 和 CVPR 版本', /合并 \d 个版本/.test(r.text) && r.href.includes('filter=cites:') && r.href.includes('|'), r);

// 2026-11-16 时这篇的 arXiv 编号还没被 OpenAlex 收录，只能按标题找到 workshop 版本；以后收录了也照样该显示数字
r = await badge('2611.17338');
check('编号未收录时按标题找到其他版本', /^被引 \d/.test(r.text) && r.cls.includes('axc-ok'), r);

// 编号查询立刻返回，标题搜索故意慢 8 秒：数字要在搜索回来之前就显示
const fakeWork = { id: 'https://openalex.org/W1', display_name: 'Fake Title', cited_by_count: 42, publication_year: 2026,
  authorships: [{ author: { display_name: 'Ann Lee' } }], primary_location: { source: { display_name: 'arXiv (Cornell University)' } } };
await ctx.route(OPENALEX, async route => {
  if (route.request().url().includes('/works/doi:')) return route.fulfill({ status: 200, headers: CORS, body: JSON.stringify(fakeWork) });
  await new Promise(res => setTimeout(res, 8000));
  return route.fulfill({ status: 200, headers: CORS, body: '{"meta":{"count":0},"results":[]}' });
});
await page.goto('https://arxiv.org/abs/2611.17461', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.axc-merging', { timeout: 4000 });
const early = await readBadge();
await shot('progressive-merging');
await page.waitForFunction(() => !document.querySelector('.axc-badge').classList.contains('axc-merging'), null, { timeout: 30000 });
const late = await readBadge();
check('先显示编号查到的数字，再后台查找其他版本', early.text.startsWith('被引 42') && early.text.includes('查找其他版本') && late.text === '被引 42', { early, late });
await ctx.unroute(OPENALEX);

// 第一次标题搜索 429 且要求等 2 秒：自动等完重试，最终正常合并
let searches = 0;
await ctx.route(OPENALEX, route => {
  if (route.request().url().includes('title.search') && ++searches === 1) {
    return route.fulfill({ status: 429, headers: { ...CORS, 'retry-after': '2' }, body: '{"error":"Rate limit exceeded","message":"Anonymous search is temporarily rate-limited","retryAfter":2}' });
  }
  return route.continue();
});
r = await badge('1810.04805');
check('搜索 429 后按 Retry-After 自动重试并合并（BERT）', searches === 2 && /合并 \d 个版本/.test(r.text), { ...r, searches });
await ctx.unroute(OPENALEX);

// 标题搜索 429 且要求等 120 秒：不重试，保留编号查到的数字，标「未合并」并写清原因
await ctx.route(OPENALEX, route => route.request().url().includes('title.search')
  ? route.fulfill({ status: 429, headers: { ...CORS, 'retry-after': '120' }, body: '{"error":"Rate limit exceeded","message":"Anonymous search is temporarily rate-limited","retryAfter":120}' })
  : route.continue());
r = await badge('2005.14165');
check('搜索长时间限流时保留数字并标未合并', /^被引 [\d,]+未合并$/.test(r.text) && r.title.includes('temporarily rate-limited'), r);
await ctx.unroute(OPENALEX);

// 模拟 OpenAlex 完全查不到：编号 404，标题搜索空结果
await ctx.route(OPENALEX, route => route.request().url().includes('/works/doi:')
  ? route.fulfill({ status: 404, headers: CORS, body: '{}' })
  : route.fulfill({ status: 200, headers: CORS, body: '{"meta":{"count":0},"results":[]}' }));
r = await badge('2611.17563');
check('查不到的论文显示未收录', r.text === '被引 未收录' && r.cls.includes('axc-missing'), r);
await ctx.unroute(OPENALEX);

// 编号查询就 429：没有数字可显示，报错并写清原因，点一下重试
await ctx.route(OPENALEX, route => route.fulfill({ status: 429, headers: { ...CORS, 'retry-after': '120' }, body: '{"error":"Rate limit exceeded","message":"rate limited for test"}' }));
r = await badge('1706.03762');
check('编号查询 429 时显示错误和原因', r.text === '被引 ⚠' && r.title.includes('429') && r.title.includes('rate limited for test'), r);

await ctx.unroute(OPENALEX);
await page.locator('a.axc-badge').click();
await page.waitForFunction(() => {
  const c = document.querySelector('.axc-badge').classList;
  return c.contains('axc-ok') && !c.contains('axc-merging');
}, null, { timeout: 120000 });
const retried = await readBadge();
await shot('1706.03762-retry');
check('点击错误徽标重试后恢复', /^被引 [\d,]+/.test(retried.text), retried);

// ---------- 设置页：OpenAlex key ----------
const opt = await ctx.newPage();
await opt.setViewportSize({ width: 400, height: 640 });
const storedKey = async () => (await opt.evaluate(() => chrome.storage.local.get('openalexKey'))).openalexKey;
const submitKey = async key => {
  await opt.fill('#key', key);
  await opt.click('#save');
  await opt.waitForFunction(() => /\b(ok|error)\b/.test(document.querySelector('#status').className), null, { timeout: 30000 });
  return opt.locator('#status').textContent();
};

await opt.goto(OPTIONS);
const saved0 = await opt.locator('#saved').textContent();
await opt.screenshot({ path: path.join(OUT, 'options-empty.png'), fullPage: true });
check('设置页能打开，显示还没填 key', saved0.includes('还没填 key'), { url: OPTIONS, saved0 });

// 假 key 发给真实 OpenAlex，应被 401 拒绝且不保存
let s = await submitKey('fake-test-key-000');
check('假 key 被真实 OpenAlex 拒绝（401），不保存', s.includes('401') && s.includes('没有保存') && !(await storedKey()), { status: s });

// 匿名请求一律 429；带对的 key 才正常返回；带错的 key 返回 401
const GOOD = 'good-key-1234';
const seen = [];
await ctx.route(OPENALEX, route => {
  const req = route.request();
  if (req.method() === 'OPTIONS') {
    return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'Authorization', 'access-control-allow-methods': 'GET' } });
  }
  const auth = req.headers()['authorization'] || '';
  seen.push({ url: req.url(), auth });
  if (!auth) return route.fulfill({ status: 429, headers: { ...CORS, 'retry-after': '120' }, body: '{"error":"Rate limit exceeded","message":"anonymous limited for test"}' });
  if (auth !== `Bearer ${GOOD}`) return route.fulfill({ status: 401, headers: CORS, body: '{"error":"Invalid or missing API key","message":"API key not found."}' });
  if (req.url().includes('/works/W2626778328')) {
    return route.fulfill({ status: 200, headers: { ...CORS, 'x-ratelimit-limit-usd': '1', 'x-ratelimit-remaining-usd': '0.9835' }, body: '{"id":"https://openalex.org/W2626778328"}' });
  }
  if (req.url().includes('/works/doi:')) return route.fulfill({ status: 200, headers: CORS, body: JSON.stringify(fakeWork) });
  return route.fulfill({ status: 200, headers: CORS, body: '{"meta":{"count":0},"results":[]}' });
});

r = await badge('2611.17464');
check('匿名限流时徽标提示去设置页填 key', r.text === '被引 ⚠' && r.title.includes('填一个免费的 OpenAlex key'), r);

await opt.bringToFront();
seen.length = 0;
s = await submitKey(GOOD);
await opt.screenshot({ path: path.join(OUT, 'options-saved.png'), fullPage: true });
const saved1 = await opt.locator('#saved').textContent();
check('能用的 key 校验通过后保存，显示额度和尾号', s.includes('key 可用') && s.includes('每天额度 $1') && s.includes('今天还剩 $0.98') && saved1.includes('尾号 1234') && (await storedKey()) === GOOD, { status: s, saved1 });

await page.bringToFront();
await page.waitForFunction(() => {
  const c = document.querySelector('.axc-badge').classList;
  return c.contains('axc-ok') && !c.contains('axc-merging');
}, null, { timeout: 30000 });
const after = await readBadge();
const leaked = seen.filter(x => x.url.includes(GOOD) || x.url.includes('api_key'));
const arxivCalls = seen.filter(x => !x.url.includes('/works/W2626778328'));
check('保存 key 后打开着的页面自动重查，请求都带 key 且 key 不进网址',
  after.text === '被引 42' && arxivCalls.length >= 2 && arxivCalls.every(x => x.auth === `Bearer ${GOOD}`) && !leaked.length,
  { after: after.text, arxivCalls, leaked });

// 已保存的 key 后来失效：徽标提示去设置页
await opt.evaluate(() => chrome.storage.local.set({ openalexKey: 'revoked-key-5678' }));
r = await badge('2611.17465');
check('已保存的 key 失效时徽标提示去设置页', r.text === '被引 ⚠' && r.title.includes('401') && r.title.includes('设置里填的 OpenAlex key 用不了'), r);

await opt.bringToFront();
await opt.reload();
await opt.click('#clear');
await opt.waitForFunction(() => document.querySelector('#saved').textContent.includes('还没填 key'));
check('清除 key 后回到匿名额度', !(await storedKey()), { saved: await opt.locator('#saved').textContent() });

await opt.emulateMedia({ colorScheme: 'dark' });
await opt.screenshot({ path: path.join(OUT, 'options-dark.png'), fullPage: true });
await ctx.unroute(OPENALEX);

await ctx.close();
fs.rmSync(profile, { recursive: true, force: true });
console.log(`\n${results.filter(Boolean).length}/${results.length} 通过，截图在 ${OUT}`);
process.exit(results.every(Boolean) ? 0 : 1);
