// 用无头 Chromium 加载插件，打开真实 arXiv 页面检查徽标、同意流程、设置页和中英文界面。不弹窗。
// 运行：node test/e2e.mjs
// 可选环境变量：EXT_DIR（要测的插件目录，默认仓库根目录；测打包产物时指向解压目录）、OUT_DIR（截图目录）
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ROOT, englishCopy, extensionId, launch } from './browser.mjs';

const EXT = fs.realpathSync(process.env.EXT_DIR ? path.resolve(process.env.EXT_DIR) : ROOT);
const OUT = process.env.OUT_DIR || path.join(os.tmpdir(), 'arxiv-citations-e2e');
const OPENALEX = 'https://api.openalex.org/**';
const PRIVACY = 'https://github.com/Li-Evan/arxiv-citations/blob/main/PRIVACY.md';
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-expose-headers': 'Retry-After, X-RateLimit-Limit-USD, X-RateLimit-Remaining-USD',
  'content-type': 'application/json',
};
const PREFLIGHT = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'Authorization', 'access-control-allow-methods': 'GET' };
const fakeWork = {
  id: 'https://openalex.org/W1', display_name: 'Fake Title', cited_by_count: 42, publication_year: 2026,
  authorships: [{ author: { display_name: 'Ann Lee' } }], primary_location: { source: { display_name: 'arXiv (Cornell University)' } },
};
fs.mkdirSync(OUT, { recursive: true });

const results = [];
function check(name, ok, info) {
  results.push(ok);
  console.log(`${ok ? '通过' : '失败'}  ${name}`);
  console.log('      ' + JSON.stringify(info));
}

// ---------- 文案文件静态检查 ----------
const msgs = loc => JSON.parse(fs.readFileSync(path.join(EXT, '_locales', loc, 'messages.json'), 'utf8'));
const en = msgs('en');
const zh = msgs('zh_CN');
const onlyEn = Object.keys(en).filter(k => !(k in zh));
const onlyZh = Object.keys(zh).filter(k => !(k in en));
check('中英文案条目一致', !onlyEn.length && !onlyZh.length, { count: Object.keys(en).length, onlyEn, onlyZh });

const used = new Set();
for (const f of fs.readdirSync(EXT).filter(f => /\.(js|html|json)$/.test(f))) {
  const src = fs.readFileSync(path.join(EXT, f), 'utf8');
  for (const rx of [/\bt\('([A-Za-z0-9_]+)'/g, /data-i18n(?:-html|-placeholder)?="([A-Za-z0-9_]+)"/g, /__MSG_([A-Za-z0-9_]+)__/g]) {
    for (const m of src.matchAll(rx)) used.add(m[1]);
  }
}
const missing = [...used].filter(k => !(k in en));
check('代码里用到的文案都存在', used.size > 50 && !missing.length, { used: used.size, missing });

// ---------- 浏览器里的公共工具 ----------
async function setup(extDir, opts) {
  const ctx = await launch(extDir, opts);
  const id = extensionId(extDir);
  const page = await ctx.newPage();
  const counter = { api: 0 };
  page.on('request', r => { if (r.url().startsWith('https://api.openalex.org/')) counter.api++; });
  return { ctx, id, page, counter };
}

// 插件装好后后台会自动打开同意页
async function waitWelcome(ctx, known = []) {
  for (let i = 0; i < 60; i++) {
    const p = ctx.pages().find(pg => pg.url().endsWith('/welcome.html') && !known.includes(pg));
    if (p) {
      await p.waitForLoadState('domcontentloaded');
      return p;
    }
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error('等了 15 秒，同意页没有打开');
}

const readBadge = page => page.locator('h1.title > a.axc-badge').evaluate(a => ({ text: a.textContent, cls: a.className, href: a.href, title: a.title }));
const shot = (page, name) => page.locator('h1.title').screenshot({ path: path.join(OUT, `${name}.png`) });
// 等徽标到某个状态；联网慢导致超时时不崩，打印徽标当时的样子，让这一项记为失败、后面继续跑
async function waitBadge(page, fn, timeout = 120000) {
  try {
    await page.waitForFunction(fn, null, { timeout });
    return true;
  } catch (err) {
    if (err.name !== 'TimeoutError') throw err;
    console.log(`      等待 ${timeout / 1000} 秒超时，徽标当前：` + JSON.stringify(await readBadge(page).catch(() => null)));
    return false;
  }
}
const isOk = () => document.querySelector('.axc-badge')?.classList.contains('axc-ok');
const settledBadge = page => waitBadge(page, () => {
  const c = document.querySelector('.axc-badge')?.classList;
  return c && !c.contains('axc-loading') && !c.contains('axc-merging');
});

async function badge(env, id, { reload = false, name = id } = {}) {
  env.counter.api = 0;
  if (reload) await env.page.reload();
  else await env.page.goto(`https://arxiv.org/abs/${id}`, { waitUntil: 'domcontentloaded' });
  await env.page.locator('h1.title > a.axc-badge').waitFor({ timeout: 30000 });
  await settledBadge(env.page);
  const info = await readBadge(env.page);
  await shot(env.page, `${name}${reload ? '-reload' : ''}`);
  return { ...info, apiCalls: env.counter.api };
}

// ================= 中文界面（本机系统语言） =================
const Z = await setup(EXT);
const { ctx, page } = Z;
const OPTIONS = `chrome-extension://${Z.id}/options.html`;

// ---------- 首次使用同意 ----------
const welcome = await waitWelcome(ctx);
const welcomeText = await welcome.locator('body').innerText();
const privacyHref = await welcome.locator(`a[href="${PRIVACY}"]`).count();
await welcome.setViewportSize({ width: 760, height: 760 });
await welcome.screenshot({ path: path.join(OUT, 'welcome-zh.png'), fullPage: true });
check('装好后自动打开中文同意页，写明发送内容并链到隐私政策',
  welcomeText.includes('欢迎使用 arXiv 引用次数') && welcomeText.includes('作者名只在你的电脑上比对') && privacyHref === 1,
  { url: welcome.url(), privacyHref });

let r = await badge(Z, '2610.27465', { name: 'before-consent' });
await page.waitForTimeout(1500);
check('同意前打开 arXiv 页面：徽标提示启用，一个请求都不发',
  r.text === '被引 · 点击启用' && r.cls.includes('axc-consent') && Z.counter.api === 0, { ...r, apiCalls: Z.counter.api });

const opened = ctx.pages().filter(p => p.url().endsWith('/welcome.html'));
await page.locator('a.axc-badge').click();
const welcome2 = await waitWelcome(ctx, opened);
check('点「点击启用」打开同意页', welcome2.url().endsWith('/welcome.html'), { url: welcome2.url() });
await welcome2.close();

Z.counter.api = 0;
await welcome.locator('#agree').click();
const agreedText = await welcome.locator('#status').innerText();
await waitBadge(page, isOk);
await settledBadge(page);
r = await readBadge(page);
check('点同意后，已打开的 arXiv 页面自动查出数字', agreedText.includes('已启用') && /^被引 \d/.test(r.text) && Z.counter.api > 0, { agreedText, ...r, apiCalls: Z.counter.api });
await welcome.close();

// ---------- 徽标 ----------
r = await badge(Z, '2610.27465', { reload: true });
check('刷新后走缓存，不再请求 OpenAlex', r.apiCalls === 0 && /^被引 \d/.test(r.text), r);

r = await badge(Z, '2611.15754');
check('曾经一直转圈的 2611.15754 显示数字', /^被引 \d/.test(r.text) && r.cls.includes('axc-ok'), r);

r = await badge(Z, '1512.03385');
check('ResNet 合并 arXiv 和 CVPR 版本', /合并 \d 个版本/.test(r.text) && r.href.includes('filter=cites:') && r.href.includes('|'), r);

// 2026-11-16 时这篇的 arXiv 编号还没被 OpenAlex 收录，只能按标题找到 workshop 版本；以后收录了也照样该显示数字
r = await badge(Z, '2611.17338');
check('编号未收录时按标题找到其他版本', /^被引 \d/.test(r.text) && r.cls.includes('axc-ok'), r);

// 编号查询立刻返回，标题搜索故意慢 8 秒：数字要在搜索回来之前就显示
await ctx.route(OPENALEX, async route => {
  if (route.request().url().includes('/works/doi:')) return route.fulfill({ status: 200, headers: CORS, body: JSON.stringify(fakeWork) });
  await new Promise(res => setTimeout(res, 8000));
  return route.fulfill({ status: 200, headers: CORS, body: '{"meta":{"count":0},"results":[]}' });
});
await page.goto('https://arxiv.org/abs/2611.17461', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.axc-merging', { timeout: 4000 });
const early = await readBadge(page);
await shot(page, 'progressive-merging');
await settledBadge(page);
const late = await readBadge(page);
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
r = await badge(Z, '1810.04805');
check('搜索 429 后按 Retry-After 自动重试并合并（BERT）', searches === 2 && /合并 \d 个版本/.test(r.text), { ...r, searches });
await ctx.unroute(OPENALEX);

// 标题搜索 429 且要求等 120 秒：不重试，保留编号查到的数字，标「未合并」并写清原因
await ctx.route(OPENALEX, route => route.request().url().includes('title.search')
  ? route.fulfill({ status: 429, headers: { ...CORS, 'retry-after': '120' }, body: '{"error":"Rate limit exceeded","message":"Anonymous search is temporarily rate-limited","retryAfter":120}' })
  : route.continue());
r = await badge(Z, '2005.14165');
check('搜索长时间限流时保留数字并标未合并', /^被引 [\d,]+未合并$/.test(r.text) && r.title.includes('temporarily rate-limited'), r);
await ctx.unroute(OPENALEX);

// 模拟 OpenAlex 完全查不到：编号 404，标题搜索空结果
await ctx.route(OPENALEX, route => route.request().url().includes('/works/doi:')
  ? route.fulfill({ status: 404, headers: CORS, body: '{}' })
  : route.fulfill({ status: 200, headers: CORS, body: '{"meta":{"count":0},"results":[]}' }));
r = await badge(Z, '2611.17563');
check('查不到的论文显示未收录', r.text === '被引 未收录' && r.cls.includes('axc-missing'), r);
await ctx.unroute(OPENALEX);

// 编号查询就 429：没有数字可显示，报错并写清原因，点一下重试
await ctx.route(OPENALEX, route => route.fulfill({ status: 429, headers: { ...CORS, 'retry-after': '120' }, body: '{"error":"Rate limit exceeded","message":"rate limited for test"}' }));
r = await badge(Z, '1706.03762');
check('编号查询 429 时显示错误和原因', r.text === '被引 ⚠' && r.title.includes('429') && r.title.includes('rate limited for test'), r);

await ctx.unroute(OPENALEX);
await page.locator('a.axc-badge').click();
await waitBadge(page, isOk);
await settledBadge(page);
const retried = await readBadge(page);
await shot(page, '1706.03762-retry');
check('点击错误徽标重试后恢复', /^被引 [\d,]+/.test(retried.text), retried);

// ---------- 设置页：OpenAlex key ----------
const opt = await ctx.newPage();
await opt.setViewportSize({ width: 400, height: 760 });
const storedKey = async () => (await opt.evaluate(() => chrome.storage.local.get('openalexKey'))).openalexKey;
const submitKey = async key => {
  await opt.fill('#key', key);
  await opt.click('#save');
  await opt.waitForFunction(() => /\b(ok|error)\b/.test(document.querySelector('#status').className), null, { timeout: 30000 });
  return opt.locator('#status').textContent();
};

await opt.goto(OPTIONS);
const saved0 = await opt.locator('#saved').textContent();
const consent0 = await opt.locator('#consentState').textContent();
check('设置页显示已同意和还没填 key', saved0.includes('还没填 key') && consent0.includes('同意') && !consent0.includes('还没同意'), { url: OPTIONS, saved0, consent0 });

// 假 key 发给真实 OpenAlex，应被 401 拒绝且不保存
let s = await submitKey('fake-test-key-000');
check('假 key 被真实 OpenAlex 拒绝（401），不保存', s.includes('401') && s.includes('没有保存') && !(await storedKey()), { status: s });

// 匿名请求一律 429；带对的 key 才正常返回；带错的 key 返回 401
const GOOD = 'good-key-1234';
const seen = [];
await ctx.route(OPENALEX, route => {
  const req = route.request();
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: PREFLIGHT });
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

await page.bringToFront();
r = await badge(Z, '2611.17464');
check('匿名限流时徽标提示去设置页填 key', r.text === '被引 ⚠' && r.title.includes('填一个免费的 OpenAlex key'), r);

await opt.bringToFront();
seen.length = 0;
s = await submitKey(GOOD);
await opt.screenshot({ path: path.join(OUT, 'options-zh.png'), fullPage: true });
const saved1 = await opt.locator('#saved').textContent();
check('能用的 key 校验通过后保存，显示额度和尾号',
  s.includes('key 可用') && s.includes('每天额度 1 美元') && s.includes('今天还剩 0.98 美元') && saved1.includes('尾号 1234') && (await storedKey()) === GOOD,
  { status: s, saved1 });

await page.bringToFront();
await waitBadge(page, isOk);
await settledBadge(page);
const after = await readBadge(page);
const leaked = seen.filter(x => x.url.includes(GOOD) || x.url.includes('api_key'));
const arxivCalls = seen.filter(x => !x.url.includes('/works/W2626778328'));
check('保存 key 后打开着的页面自动重查，请求都带 key 且 key 不进网址',
  after.text === '被引 42' && arxivCalls.length >= 2 && arxivCalls.every(x => x.auth === `Bearer ${GOOD}`) && !leaked.length,
  { after: after.text, arxivCalls: arxivCalls.length, leaked });

// 已保存的 key 后来失效：徽标提示去设置页
await opt.evaluate(() => chrome.storage.local.set({ openalexKey: 'revoked-key-5678' }));
r = await badge(Z, '2611.17465');
check('已保存的 key 失效时徽标提示去设置页', r.text === '被引 ⚠' && r.title.includes('401') && r.title.includes('设置里填的 OpenAlex key 用不了'), r);

await opt.bringToFront();
await opt.reload();
await opt.click('#clear');
await opt.waitForFunction(() => document.querySelector('#saved').textContent.includes('还没填 key'));
check('清除 key 后回到匿名额度', !(await storedKey()), { saved: await opt.locator('#saved').textContent() });
await ctx.unroute(OPENALEX);

// ---------- 撤回同意 ----------
await page.bringToFront();
await badge(Z, '2610.27465');
await opt.bringToFront();
await opt.click('#withdraw');
await opt.waitForFunction(() => document.querySelector('#consentState').textContent.includes('还没同意'));
const left = await opt.evaluate(() => chrome.storage.local.get(null));
const cacheLeft = Object.keys(left).filter(k => k.startsWith('axc:'));
await page.bringToFront();
await waitBadge(page, () => document.querySelector('.axc-badge')?.classList.contains('axc-consent'), 10000);
const withdrawnBadge = await readBadge(page);
r = await badge(Z, '1512.03385', { name: 'after-withdraw' });
await page.waitForTimeout(1500);
check('撤回同意后清空缓存，打开着和新打开的页面都回到「点击启用」且不发请求',
  !left.consent && !cacheLeft.length && withdrawnBadge.cls.includes('axc-consent') && r.cls.includes('axc-consent') && Z.counter.api === 0,
  { cacheLeft, withdrawnBadge: withdrawnBadge.text, after: r.text, apiCalls: Z.counter.api });

await opt.emulateMedia({ colorScheme: 'dark' });
await opt.screenshot({ path: path.join(OUT, 'options-zh-dark.png'), fullPage: true });
await Z.ctx.cleanup();

// ================= 英文界面 =================
const enDir = englishCopy(EXT);
const E = await setup(enDir, { locale: 'en-US' });
const hasHan = s => /[一-鿿]/.test(s);

const welcomeEn = await waitWelcome(E.ctx);
const welcomeEnText = await welcomeEn.locator('body').innerText();
await welcomeEn.setViewportSize({ width: 760, height: 760 });
await welcomeEn.screenshot({ path: path.join(OUT, 'welcome-en.png'), fullPage: true });
check('英文同意页全是英文', welcomeEnText.includes('Welcome to Citation Counts for arXiv') && welcomeEnText.includes('never sent') && !hasHan(welcomeEnText), { title: await welcomeEn.title() });

r = await badge(E, '2610.27465', { name: 'en-before-consent' });
check('英文徽标同意前显示「click to enable」', r.text === 'Citations · click to enable', r);

await E.ctx.route(OPENALEX, route => route.request().url().includes('/works/doi:')
  ? route.fulfill({ status: 200, headers: CORS, body: JSON.stringify(fakeWork) })
  : route.fulfill({ status: 200, headers: CORS, body: '{"meta":{"count":0},"results":[]}' }));
await welcomeEn.locator('#agree').click();
await waitBadge(E.page, isOk);
await settledBadge(E.page);
r = await readBadge(E.page);
await shot(E.page, 'en-badge');
check('英文徽标和提示', r.text === 'Cited by 42' && r.title.startsWith('Citations in OpenAlex') && r.title.includes('cached for 12 hours') && !hasHan(r.title), r);
await E.ctx.unroute(OPENALEX);

await E.ctx.route(OPENALEX, route => route.fulfill({ status: 429, headers: { ...CORS, 'retry-after': '120' }, body: '{"error":"Rate limit exceeded","message":"limited"}' }));
r = await badge(E, '2611.17466', { name: 'en-error' });
check('英文报错提示', r.text === 'Cited by ⚠' && r.title.includes('A free OpenAlex key avoids the anonymous rate limit') && !hasHan(r.title), r);
await E.ctx.unroute(OPENALEX);

const optEn = await E.ctx.newPage();
await optEn.setViewportSize({ width: 400, height: 760 });
await optEn.goto(`chrome-extension://${E.id}/options.html`);
const optEnText = await optEn.locator('body').innerText();
const placeholder = await optEn.locator('#key').getAttribute('placeholder');
await optEn.screenshot({ path: path.join(OUT, 'options-en.png'), fullPage: true });
check('英文设置页全是英文', optEnText.includes('Citation Counts for arXiv · Settings') && optEnText.includes('No key saved') && placeholder === 'Paste your key' && !hasHan(optEnText),
  { title: await optEn.title(), placeholder });

await E.ctx.cleanup();
fs.rmSync(enDir, { recursive: true, force: true });

console.log(`\n${results.filter(Boolean).length}/${results.length} 通过，截图在 ${OUT}`);
process.exit(results.every(Boolean) ? 0 : 1);
