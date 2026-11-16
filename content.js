const API = 'https://api.openalex.org';
const FIELDS = 'id,display_name,cited_by_count,publication_year,authorships,primary_location';
const CACHE_TTL = 12 * 60 * 60 * 1000;

const metas = name => [...document.querySelectorAll(`meta[name="${name}"]`)].map(m => m.content);

const stripMarks = s => s.normalize('NFKD').replace(/\p{M}/gu, '');
const normTitle = s => stripMarks(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
// arXiv 给 "He, Kaiming"，OpenAlex 给 "Kaiming He"，统一取姓
const lastName = s => stripMarks(s.includes(',') ? s.split(',')[0] : s.trim().split(/\s+/).pop()).toLowerCase();
const shortId = w => w.id.split('/').pop();

async function getJSON(url) {
  const res = await fetch(url);
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = (await res.text()).slice(0, 200);
    const hint = res.status === 429 ? '（限流：免费额度按网络出口 IP 共享，用完要等第二天恢复；偶尔也是请求太密，稍后点一下重试）' : '';
    throw new Error(`OpenAlex 返回 ${res.status}${hint}：${body}`);
  }
  return res.json();
}

async function lookup(arxivId, title, authors) {
  const main = await getJSON(`${API}/works/doi:10.48550/arXiv.${arxivId}?select=${FIELDS}`);
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

  const ids = versions.map(shortId).join('|');
  let count = versions[0].cited_by_count;
  if (versions.length > 1) {
    // 引用了任一版本的论文去重计数，两个版本都引用的只算一次
    count = (await getJSON(`${API}/works?filter=cites:${ids}&per-page=1&select=id`)).meta.count;
  }
  return {
    status: 'ok',
    count,
    ids,
    versions: versions.map(w => ({
      year: w.publication_year,
      venue: w.primary_location?.source?.display_name || '来源未知',
      cites: w.cited_by_count,
    })),
    fetchedAt: Date.now(),
  };
}

async function cached(arxivId, title, authors, force) {
  const key = `axc:${arxivId}`;
  if (!force) {
    const hit = (await chrome.storage.local.get(key))[key];
    if (hit && Date.now() - hit.fetchedAt < CACHE_TTL) return hit;
  }
  const result = await lookup(arxivId, title, authors);
  await chrome.storage.local.set({ [key]: result });
  return result;
}

const fmt = n => n.toLocaleString('en-US');
const venueLabel = v => (v.startsWith('arXiv') ? 'arXiv' : v.length > 40 ? v.slice(0, 40) + '…' : v);
const timeLabel = t => new Date(t).toLocaleString('zh-CN', { hour12: false });

function render(badge, state) {
  badge.className = `axc-badge axc-${state.status}`;
  badge.removeAttribute('href');
  if (state.status === 'loading') {
    badge.textContent = '被引 …';
    badge.title = '正在从 OpenAlex 查询引用次数';
  } else if (state.status === 'ok') {
    badge.textContent = `被引 ${fmt(state.count)}`;
    if (state.versions.length > 1) {
      const sub = document.createElement('span');
      sub.className = 'axc-sub';
      sub.textContent = `合并 ${state.versions.length} 个版本`;
      badge.append(sub);
    }
    badge.href = `https://openalex.org/works?filter=cites:${state.ids}`;
    badge.title = [
      state.versions.length > 1
        ? 'OpenAlex 引用次数：引用了任一版本的论文去重计数'
        : 'OpenAlex 引用次数',
      ...state.versions.map(v => `· ${venueLabel(v.venue)} ${v.year}：${fmt(v.cites)}`),
      `数据时间 ${timeLabel(state.fetchedAt)}（缓存 12 小时）`,
      '点击查看引用了这篇论文的列表',
    ].join('\n');
  } else if (state.status === 'missing') {
    badge.textContent = '被引 未收录';
    badge.title = `OpenAlex 还没收录这篇论文，新论文一般要几天到两周才收录。\n数据时间 ${timeLabel(state.fetchedAt)}，点击重新查询`;
  } else {
    badge.textContent = '被引 ⚠';
    badge.title = `查询失败：${state.message}\n点击重试`;
  }
}

async function main() {
  const h1 = document.querySelector('h1.title');
  const arxivId = metas('citation_arxiv_id')[0];
  if (!h1 || !arxivId) return;

  const title = metas('citation_title')[0] || h1.textContent.replace(/^Title:/, '');
  const authors = metas('citation_author');
  const badge = document.createElement('a');
  badge.target = '_blank';
  badge.rel = 'noopener';
  h1.append(badge);

  const run = async force => {
    render(badge, { status: 'loading' });
    try {
      render(badge, await cached(arxivId, title, authors, force));
    } catch (err) {
      console.error('[arXiv 引用次数]', err);
      render(badge, { status: 'error', message: err.message });
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
