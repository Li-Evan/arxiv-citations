// 导出图标（16/32/48/128）和 440x280 小宣传图。运行：node store/make-assets.mjs
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, launch } from '../test/browser.mjs';

const svg = fs.readFileSync(path.join(ROOT, 'store/art/icon.svg'), 'utf8');
// 128 按商店规范保留四周 16 像素透明边；工具栏小图标去掉留白，图案铺满
const tight = svg.replace('viewBox="0 0 128 128"', 'viewBox="16 16 96 96"');

const ctx = await launch(null);
const page = await ctx.newPage();
for (const [size, source] of [[128, svg], [48, tight], [32, tight], [16, tight]]) {
  await page.setViewportSize({ width: size, height: size });
  const sized = source.replace('width="128" height="128"', `width="${size}" height="${size}"`);
  await page.setContent(`<body style="margin:0;background:transparent">${sized}</body>`);
  await page.screenshot({ path: path.join(ROOT, `icons/icon${size}.png`), omitBackground: true });
}
await page.setViewportSize({ width: 440, height: 280 });
await page.goto('file://' + path.join(ROOT, 'store/art/promo.html'));
await page.screenshot({ path: path.join(ROOT, 'store/images/promo-small-440x280.png') });
await ctx.cleanup();
console.log('已导出 icons/icon{16,32,48,128}.png 和 store/images/promo-small-440x280.png');
