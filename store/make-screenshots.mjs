// 生成商店截图（1280x800，中英文各三张），用真实 arXiv 页面和真实 OpenAlex 数据。不弹窗。
// 运行：node store/make-screenshots.mjs
// 时区固定 UTC，截图里的时间不透露所在地
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, englishCopy, extensionId, launch } from '../test/browser.mjs';

const OUT = path.join(ROOT, 'store/images');
const SIZE = { width: 1280, height: 800 };

async function shoot(lang, extDir, opts) {
  const ctx = await launch(extDir, opts);
  const id = extensionId(extDir);
  let welcome;
  for (let i = 0; i < 60 && !welcome; i++) {
    welcome = ctx.pages().find(p => p.url().endsWith('/welcome.html'));
    if (!welcome) await new Promise(r => setTimeout(r, 250));
  }
  if (!welcome) throw new Error('同意页没有自动打开');
  await welcome.setViewportSize(SIZE);
  await welcome.waitForLoadState('domcontentloaded');
  await welcome.screenshot({ path: path.join(OUT, `${lang}-3-welcome.png`) });
  await welcome.locator('#agree').click();

  const page = await ctx.newPage();
  await page.setViewportSize(SIZE);
  await page.goto('https://arxiv.org/abs/1512.03385', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const c = document.querySelector('.axc-badge')?.classList;
    return c && c.contains('axc-ok') && !c.contains('axc-merging');
  }, null, { timeout: 120000 });
  const text = await page.locator('.axc-badge').textContent();
  await page.screenshot({ path: path.join(OUT, `${lang}-1-arxiv.png`) });

  const opt = await ctx.newPage();
  await opt.setViewportSize(SIZE);
  await opt.goto(`chrome-extension://${id}/options.html`);
  await opt.screenshot({ path: path.join(OUT, `${lang}-2-settings.png`) });

  await ctx.cleanup();
  console.log(`${lang}: 徽标「${text}」，已写入 store/images/${lang}-{1-arxiv,2-settings,3-welcome}.png`);
}

fs.mkdirSync(OUT, { recursive: true });
await shoot('zh', ROOT, { timezoneId: 'UTC' });
const enDir = englishCopy(ROOT);
await shoot('en', enDir, { locale: 'en-US', timezoneId: 'UTC' });
fs.rmSync(enDir, { recursive: true, force: true });
