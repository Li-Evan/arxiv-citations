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

async function badge(id, { reload = false } = {}) {
  apiCalls = 0;
  if (reload) await page.reload();
  else await page.goto(`https://arxiv.org/abs/${id}`, { waitUntil: 'domcontentloaded' });
  const el = page.locator('h1.title > a.axc-badge');
  await el.waitFor({ timeout: 30000 });
  await page.waitForFunction(() => !document.querySelector('.axc-badge').classList.contains('axc-loading'), null, { timeout: 30000 });
  const info = await el.evaluate(a => ({ text: a.textContent, cls: a.className, href: a.href, title: a.title }));
  await page.locator('h1.title').screenshot({ path: path.join(OUT, `${id.replace('/', '_')}${reload ? '-reload' : ''}.png`) });
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

r = await badge('1512.03385');
check('ResNet 合并 arXiv 和 CVPR 版本', /合并 \d 个版本/.test(r.text) && r.href.includes('filter=cites:') && r.href.includes('|'), r);

r = await badge('1810.04805');
check('BERT 合并多个版本', /合并 \d 个版本/.test(r.text), r);

// 2026-11-16 时这篇的 arXiv 编号还没被 OpenAlex 收录，只能按标题找到 workshop 版本；以后收录了也照样该显示数字
r = await badge('2611.17338');
check('编号未收录时按标题找到其他版本', /^被引 \d/.test(r.text) && r.cls.includes('axc-ok'), r);

// 模拟 OpenAlex 完全查不到：编号 404，标题搜索空结果
await ctx.route('https://api.openalex.org/**', route => route.request().url().includes('/works/doi:')
  ? route.fulfill({ status: 404, body: '{}' })
  : route.fulfill({ status: 200, contentType: 'application/json', body: '{"meta":{"count":0},"results":[]}' }));
r = await badge('2611.17563');
check('查不到的论文显示未收录', r.text === '被引 未收录' && r.cls.includes('axc-missing'), r);
await ctx.unroute('https://api.openalex.org/**');

await ctx.route('https://api.openalex.org/**', route => route.fulfill({ status: 429, body: '{"error":"rate limited"}' }));
r = await badge('1706.03762');
check('接口 429 时显示错误和原因', r.text === '被引 ⚠' && r.title.includes('429'), r);

await ctx.unroute('https://api.openalex.org/**');
await page.locator('a.axc-badge').click();
await page.waitForFunction(() => document.querySelector('.axc-badge').classList.contains('axc-ok'), null, { timeout: 30000 });
const retried = await page.locator('a.axc-badge').evaluate(a => ({ text: a.textContent, title: a.title }));
await page.locator('h1.title').screenshot({ path: path.join(OUT, '1706.03762-retry.png') });
check('点击错误徽标重试后恢复', /^被引 [\d,]+/.test(retried.text), retried);

await ctx.close();
fs.rmSync(profile, { recursive: true, force: true });
console.log(`\n${results.filter(Boolean).length}/${results.length} 通过，截图在 ${OUT}`);
process.exit(results.every(Boolean) ? 0 : 1);
