const API = 'https://api.openalex.org';
const FIELDS = 'id,display_name,cited_by_count,publication_year,authorships,primary_location';
const CACHE_TTL = 12 * 60 * 60 * 1000;
const TIMEOUT = 20000;
const MAX_RETRY_WAIT = 60;

const metas = name => [...document.querySelectorAll(`meta[name="${name}"]`)].map(m => m.content);

const stripMarks = s => s.normalize('NFKD').replace(/\p{M}/gu, '');
const normTitle = s => stripMarks(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
// arXiv 给 "He, Kaiming"，OpenAlex 给 "Kaiming He"，统一取姓
const lastName = s => stripMarks(s.includes(',') ? s.split(',')[0] : s.trim().split(/\s+/).pop()).toLowerCase();
const shortId = w => w.id.split('/').pop();
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getJSON(url) {
  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT) });
  } catch (err) {
    throw new Error(err.name === 'TimeoutError' ? `OpenAlex ${TIMEOUT / 1000} 秒没响应` : `连不上 OpenAlex：${err.message}`);
  }
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    let body = {};
    try { body = JSON.parse(text); } catch {}
    const err = new Error(`OpenAlex 返回 ${res.status}：${body.message || text.slice(0, 200)}`);
    err.retryAfter = Number(res.headers.get('retry-after')) || body.retryAfter || 0;
    throw err;
  }
  return res.json();
}

function summarize(versions, count) {
  return {
    status: 'ok',
    count,
    ids: versions.map(shortId).join('|'),
    versions: versions.map(w => ({
      year: w.publication_year,
      venue: w.primary_location?.source?.display_name || '来源未知',
      cites: w.cited_by_count,
    })),
    fetchedAt: Date.now(),
  };
}

async function merge(main, title, authors) {
  const q = normTitle(main?.display_name || title);
  const found = await getJSON(`${API}/works?filter=title.search:${encodeURIComponent(q)}&select=${FIELDS}&per-page=25`);
  const names = new Set((main ? main.authorships.map(a => a.author.display_name) : authors).map(lastName));

  // 同名且至少有一位作者同姓，才算同一篇论文的不同版本
  const versions = found.results.filter(w =>
    normTitle(w.display_name || '') === q &&
    w.authorships.some(a => names.has(lastName(a.author.display_name)))
  );
  if (main && !versions.some(w => w.id === main.id)) versions.push(main);
  if (!versions.length) return { status: 'missing', fetchedAt: Date.now() };
  if (versions.length === 1) return summarize(versions, versions[0].cited_by_count);

  // 引用了任一版本的论文去重计数，两个版本都引用的只算一次
  const union = await getJSON(`${API}/works?filter=cites:${versions.map(shortId).join('|')}&per-page=1&select=id`);
  return summarize(versions, union.meta.count);
}

// OpenAlex 搜索常被临时限流并给出 Retry-After，等得不久就自动再试一次
async function mergeWithRetry(main, title, authors, onWait) {
  try {
    return await merge(main, title, authors);
  } catch (err) {
    if (!err.retryAfter || err.retryAfter > MAX_RETRY_WAIT) throw err;
    onWait(`OpenAlex 搜索限流，${err.retryAfter} 秒后自动重试`);
    await sleep(err.retryAfter * 1000);
    return merge(main, title, authors);
  }
}

const fmt = n => n.toLocaleString('en-US');
const venueLabel = v => (v.startsWith('arXiv') ? 'arXiv' : v.length > 40 ? v.slice(0, 40) + '…' : v);
const timeLabel = t => new Date(t).toLocaleString('zh-CN', { hour12: false });

function subLabel(badge, text, warn) {
  const sub = document.createElement('span');
  sub.className = warn ? 'axc-sub axc-sub-warn' : 'axc-sub';
  sub.textContent = text;
  badge.append(sub);
}

function render(badge, s) {
  badge.className = `axc-badge axc-${s.status}${s.merging ? ' axc-merging' : ''}`;
  badge.removeAttribute('href');
  if (s.status === 'loading') {
    badge.textContent = '被引 …';
    badge.title = s.note || '正在从 OpenAlex 查询引用次数';
  } else if (s.status === 'ok') {
    badge.textContent = `被引 ${fmt(s.count)}`;
    if (s.merging) subLabel(badge, '查找其他版本…');
    else if (s.mergeError) subLabel(badge, '未合并', true);
    else if (s.versions.length > 1) subLabel(badge, `合并 ${s.versions.length} 个版本`);
    badge.href = `https://openalex.org/works?filter=cites:${s.ids}`;
    badge.title = [
      s.versions.length > 1 ? 'OpenAlex 引用次数：引用了任一版本的论文去重计数' : 'OpenAlex 引用次数',
      ...s.versions.map(v => `· ${venueLabel(v.venue)} ${v.year}：${fmt(v.cites)}`),
      s.merging && `只显示了 arXiv 这条记录的数字，正在查找同一论文的其他发表版本。${s.merging === true ? '' : s.merging}`,
      s.mergeError && `只统计了 arXiv 这一条记录，查找其他发表版本失败：${s.mergeError}\n刷新页面会重试`,
      !s.merging && !s.mergeError && `数据时间 ${timeLabel(s.fetchedAt)}（缓存 12 小时）`,
      '点击查看引用了这篇论文的列表',
    ].filter(Boolean).join('\n');
  } else if (s.status === 'missing') {
    badge.textContent = '被引 未收录';
    badge.title = `OpenAlex 还没收录这篇论文，新论文一般要几天到两周才收录。\n数据时间 ${timeLabel(s.fetchedAt)}，点击重新查询`;
  } else {
    badge.textContent = '被引 ⚠';
    badge.title = `查询失败：${s.message}\n点击重试`;
  }
}

async function main() {
  const h1 = document.querySelector('h1.title');
  const arxivId = metas('citation_arxiv_id')[0];
  if (!h1 || !arxivId) return;

  const title = metas('citation_title')[0] || h1.textContent.replace(/^Title:/, '');
  const authors = metas('citation_author');
  const key = `axc:${arxivId}`;
  const badge = document.createElement('a');
  badge.target = '_blank';
  badge.rel = 'noopener';
  h1.append(badge);

  const run = async force => {
    if (!force) {
      const hit = (await chrome.storage.local.get(key))[key];
      if (hit && Date.now() - hit.fetchedAt < CACHE_TTL) return render(badge, hit);
    }
    render(badge, { status: 'loading' });

    let partial = null;
    try {
      const main = await getJSON(`${API}/works/doi:10.48550/arXiv.${arxivId}?select=${FIELDS}`);
      if (main) {
        partial = summarize([main], main.cited_by_count);
        render(badge, { ...partial, merging: true });
      }
      const result = await mergeWithRetry(main, title, authors, note =>
        render(badge, partial ? { ...partial, merging: note } : { status: 'loading', note }));
      await chrome.storage.local.set({ [key]: result });
      render(badge, result);
    } catch (err) {
      console.error('[arXiv 引用次数]', err);
      render(badge, partial ? { ...partial, mergeError: err.message } : { status: 'error', message: err.message });
    }
  };

  badge.addEventListener('click', e => {
    if (badge.classList.contains('axc-ok')) return;
    e.preventDefault();
    run(true);
  });
  run(false);
}

main();
