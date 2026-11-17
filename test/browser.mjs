// 测试和出图共用：找本机 Playwright 和 Chrome for Testing，无头加载插件。不弹窗。
// 可选环境变量：PLAYWRIGHT_CORE（playwright-core 目录）、CHROME_PATH（Chrome for Testing 可执行文件）
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

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

export const { chromium } = require(process.env.PLAYWRIGHT_CORE || findPlaywright());

// 解压加载的插件，ID 由目录绝对路径的 sha256 前 32 位换成 a-p 得到
export const extensionId = dir => [...crypto.createHash('sha256').update(fs.realpathSync(dir)).digest('hex').slice(0, 32)]
  .map(c => String.fromCharCode(97 + parseInt(c, 16))).join('');

// macOS 上 Chrome 按系统语言挑插件文案，命令行改不了。英文版的做法：复制一份插件并删掉 zh_CN 文案，Chrome 就退回默认的英文
export function englishCopy(dir) {
  const copy = fs.mkdtempSync(path.join(os.tmpdir(), 'axc-en-'));
  fs.cpSync(dir, copy, { recursive: true, filter: src => !src.includes(`${path.sep}_locales${path.sep}zh_CN`) && !src.includes(`${path.sep}.git`) });
  return copy;
}

export async function launch(extDir, { locale, timezoneId } = {}) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'axc-profile-'));
  const args = extDir ? [`--disable-extensions-except=${extDir}`, `--load-extension=${extDir}`] : [];
  const ctx = await chromium.launchPersistentContext(profile, {
    executablePath: process.env.CHROME_PATH || findChrome(),
    headless: true,
    viewport: { width: 1400, height: 900 },
    ...(locale ? { locale } : {}),
    ...(timezoneId ? { timezoneId } : {}),
    args,
  });
  ctx.cleanup = async () => {
    await ctx.close();
    fs.rmSync(profile, { recursive: true, force: true });
  };
  return ctx;
}
