// 文案在 _locales/*/messages.json，浏览器是简体中文就用 zh_CN，其他一律英文。
// 占位符写成 {name}，不用 chrome.i18n 自带的 $ 占位符。
const t = (key, vars = {}) => {
  const raw = chrome.i18n.getMessage(key);
  if (!raw) throw new Error(`[arXiv citations] missing message: ${key}`);
  return Object.entries(vars).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, v), raw);
};

const uiLang = () => chrome.i18n.getUILanguage();

function applyI18n() {
  document.documentElement.lang = uiLang();
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-html]').forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => { el.placeholder = t(el.dataset.i18nPlaceholder); });
}
