const API = 'https://api.openalex.org';
const KEY = 'openalexKey';
const CONSENT = 'consent';
const $ = id => document.getElementById(id);

function status(text, kind) {
  $('status').textContent = text;
  $('status').className = `status ${kind}`;
}

async function showSaved() {
  const key = (await chrome.storage.local.get(KEY))[KEY];
  $('saved').textContent = key ? t('optSavedYes', { tail: key.slice(-4) }) : t('optSavedNo');
  $('clear').hidden = !key;
}

async function showConsent() {
  const consent = (await chrome.storage.local.get(CONSENT))[CONSENT];
  const time = consent && new Date(consent.at).toLocaleString(uiLang(), { hour12: false });
  $('consentState').textContent = consent ? t('optConsentOn', { time }) : t('optConsentOff');
  $('enable').hidden = Boolean(consent);
  $('withdraw').hidden = !consent;
}

// 按编号查单篇不花额度，响应头里带着当天额度和剩余额度
async function check(key) {
  let res;
  try {
    res = await fetch(`${API}/works/W2626778328?select=id`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(20000),
    });
  } catch (err) {
    throw new Error(err.name === 'TimeoutError' ? t('optErrTimeout') : t('errNetwork', { msg: err.message }));
  }
  if (res.ok) {
    return {
      limit: res.headers.get('x-ratelimit-limit-usd'),
      remaining: res.headers.get('x-ratelimit-remaining-usd'),
    };
  }
  const text = await res.text();
  let body = {};
  try { body = JSON.parse(text); } catch {}
  const reason = body.message || body.error || text.slice(0, 200);
  if (res.status === 401) throw new Error(t('optErr401'));
  if (res.status === 403) throw new Error(t('optErr403', { code: body.error || body.code || reason }));
  if (res.status === 429) throw new Error(t('optErr429', { reason }));
  throw new Error(t('errStatus', { status: res.status, msg: reason }));
}

const money = x => Number(x).toFixed(2).replace(/\.00$/, '');

$('form').addEventListener('submit', async e => {
  e.preventDefault();
  const key = $('key').value.trim();
  if (!key) return status(t('optEmpty'), 'error');
  $('save').disabled = true;
  status(t('optChecking'), 'pending');
  try {
    const r = await check(key);
    await chrome.storage.local.set({ [KEY]: key });
    $('key').value = '';
    const quota = r.limit ? t('optQuota', { limit: money(r.limit), remaining: money(r.remaining) }) : '';
    status(t('optKeyOk', { quota }), 'ok');
    await showSaved();
  } catch (err) {
    status(t('optNotSaved', { reason: err.message }), 'error');
  } finally {
    $('save').disabled = false;
  }
});

$('clear').addEventListener('click', async () => {
  await chrome.storage.local.remove(KEY);
  status(t('optCleared'), 'ok');
  await showSaved();
});

// 撤回同意时一并清掉本机缓存的查询结果
$('withdraw').addEventListener('click', async () => {
  const all = await chrome.storage.local.get(null);
  await chrome.storage.local.remove([CONSENT, ...Object.keys(all).filter(k => k.startsWith('axc:'))]);
  status(t('optWithdrawn'), 'ok');
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && CONSENT in changes) showConsent();
});

applyI18n();
document.title = t('optTitle');
showConsent();
showSaved();
