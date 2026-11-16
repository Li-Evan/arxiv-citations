const API = 'https://api.openalex.org';
const KEY = 'openalexKey';
const $ = id => document.getElementById(id);

function status(text, kind) {
  $('status').textContent = text;
  $('status').className = `status ${kind}`;
}

async function showSaved() {
  const key = (await chrome.storage.local.get(KEY))[KEY];
  $('saved').textContent = key ? `已保存 key，尾号 ${key.slice(-4)}` : '还没填 key，现在用的是匿名额度';
  $('clear').hidden = !key;
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
    throw new Error(err.name === 'TimeoutError' ? 'OpenAlex 20 秒没响应，稍后再试' : `连不上 OpenAlex：${err.message}`);
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
  if (res.status === 401) throw new Error(`OpenAlex 找不到这个 key（401）。检查是否复制完整，或者去 OpenAlex 的 Settings → API key 重新复制`);
  if (res.status === 403) throw new Error(`OpenAlex 拒绝了这个 key（403，${body.error || body.code || reason}）。刚注册的话，先去邮箱点激活链接`);
  if (res.status === 429) throw new Error(`OpenAlex 限流（429），稍后再试：${reason}`);
  throw new Error(`OpenAlex 返回 ${res.status}：${reason}`);
}

const usd = x => `$${Number(x).toFixed(2).replace(/\.00$/, '')}`;

$('form').addEventListener('submit', async e => {
  e.preventDefault();
  const key = $('key').value.trim();
  if (!key) return status('先把 key 粘贴进输入框', 'error');
  $('save').disabled = true;
  status('正在向 OpenAlex 校验…', 'pending');
  try {
    const r = await check(key);
    await chrome.storage.local.set({ [KEY]: key });
    $('key').value = '';
    const quota = r.limit ? `：每天额度 ${usd(r.limit)}，今天还剩 ${usd(r.remaining)}` : '';
    status(`key 可用${quota}。已保存，打开着的 arXiv 页面里没查成功的徽标会自动重查。`, 'ok');
    await showSaved();
  } catch (err) {
    status(`${err.message}。没有保存。`, 'error');
  } finally {
    $('save').disabled = false;
  }
});

$('clear').addEventListener('click', async () => {
  await chrome.storage.local.remove(KEY);
  status('已清除，回到匿名额度。', 'ok');
  await showSaved();
});

showSaved();
