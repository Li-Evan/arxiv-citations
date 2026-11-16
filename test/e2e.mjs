// 用无头 Chromium 加载插件，打开真实 arXiv 页面检查徽标。不弹窗。
// 运行：node test/e2e.mjs
// 可选环境变量：PLAYWRIGHT_CORE（playwright-core 目录）、CHROME_PATH（Chrome for Testing 可执行文件）、OUT_DIR（截图目录）
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const EXT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = process.env.OUT_DIR || path.join(os.tmpdir(), 'arxiv-citations-e2e');
const OPENALEX = 'https://api.openalex.org/**';
const CORS = { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'Retry-After', 'content-type': 'application/json' };

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

await ctx.close();
fs.rmSync(profile, { recursive: true, force: true });
console.log(`\n${results.filter(Boolean).length}/${results.length} 通过，截图在 ${OUT}`);
process.exit(results.every(Boolean) ? 0 : 1);
