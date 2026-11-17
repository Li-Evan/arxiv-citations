# 商店后台填写内容（复制粘贴用）

上架步骤见 [PUBLISHING.md](PUBLISHING.md)。下面按开发者后台的标签页顺序排列，代码块里的内容直接复制。

## 软件包（Package）

上传 `dist/arxiv-citations-0.3.0.zip`（`sh scripts/package.sh` 生成）。

名称和简介来自压缩包里的文案文件，后台改不了：

- 英文名：Citation Counts for arXiv
- 中文名：arXiv 引用次数（浏览器语言是简体中文的用户看到这个）
- 英文简介：Shows citation counts next to arXiv paper titles. Data from OpenAlex; preprint and published versions are merged.

## 商店信息（Store listing）

### 详细说明：英文（默认语言）

```
See how often an arXiv paper has been cited, without leaving the page.

On every arXiv abstract page (arxiv.org/abs/…), a small badge appears next to the paper title:

• "Cited by 292,847": the citation count from OpenAlex, a free and open database of scholarly works.
• Preprint and published versions are merged. OpenAlex often keeps a paper's arXiv preprint and its conference or journal version as separate records. The extension finds the versions that share the title and at least one author, then counts the papers citing any of them, each once.
• Hover over the badge to see each version's own count. Click it to open the list of citing papers on OpenAlex.
• The count for the arXiv record shows up first; other versions are merged in the background.
• Results are cached for 12 hours, so revisiting a paper is instant.

Optional: add a free OpenAlex API key in the settings to avoid OpenAlex's anonymous rate limits.

Privacy: the extension sends only the paper's arXiv ID and title to OpenAlex, and only after you agree on its welcome page. It has no server of its own and collects nothing. Source code and privacy policy: https://github.com/Li-Evan/arxiv-citations

Note: OpenAlex counts are usually lower than Google Scholar's, because the two index different sources.

Not affiliated with arXiv or OpenAlex.
```

### 详细说明：中文（简体）

后台顶部语言下拉选「中文（简体）」后填写。

```
不用离开页面，就能看到一篇 arXiv 论文被引用了多少次。

打开任意 arXiv 论文摘要页（arxiv.org/abs/…），标题右边会出现一个小徽标：

• 「被引 292,847」：引用次数来自 OpenAlex，一个免费开放的学术数据库。
• 预印本和正式发表版本合并计数。OpenAlex 常把同一篇论文的 arXiv 预印本和会议、期刊版本存成两条记录。插件会找出标题相同、至少有一位作者相同的各个版本，统计引用了其中任一版本的论文，每篇只算一次。
• 鼠标悬停在徽标上，能看到每个版本各自的引用数；点击徽标，打开 OpenAlex 上引用了这篇论文的列表。
• 先显示 arXiv 这条记录的数字，其他版本在后台合并。
• 查询结果缓存 12 小时，再次打开同一篇论文时直接显示。

可选：在设置里填一个免费的 OpenAlex API key，可以避开 OpenAlex 对匿名请求的限流。

隐私：插件只把论文的 arXiv 编号和标题发给 OpenAlex，而且要等你在说明页点了同意才开始。插件没有自己的服务器，不收集任何数据。源码和隐私政策：https://github.com/Li-Evan/arxiv-citations

说明：OpenAlex 的数字通常比 Google Scholar 小，因为两家收录的引用来源不同。

本插件与 arXiv、OpenAlex 均无关联。
```

### 类别

教育（Education）

### 语言

英语（English）。中文（简体）作为本地化语言另外填写详细说明和截图。

### 图片

| 后台栏位 | 文件 | 尺寸 |
|---------|------|------|
| 商店图标 | `icons/icon128.png` | 128×128 |
| 截图（默认/英文） | `store/images/en-1-arxiv.png`、`en-2-settings.png`、`en-3-welcome.png`，按这个顺序 | 1280×800 |
| 截图（中文（简体）） | `store/images/zh-1-arxiv.png`、`zh-2-settings.png`、`zh-3-welcome.png` | 1280×800 |
| 小宣传图 | `store/images/promo-small-440x280.png` | 440×280 |
| 大宣传图 | 不填（可选） | |

图片都用脚本生成：图标和宣传图 `node store/make-assets.mjs`，截图 `node store/make-screenshots.mjs`（真实 arXiv 页面和真实 OpenAlex 数据，数字会随时间变）。

### 其他栏位

- 主页网址（Homepage URL）：`https://github.com/Li-Evan/arxiv-citations`
- 支持网址（Support URL）：`https://github.com/Li-Evan/arxiv-citations/issues`
- 官方网址（Official URL）：不填，需要先在 Google Search Console 验证网站所有权

## 隐私权规范（Privacy）

### 单一用途说明（Single purpose）

```
Show the citation count of the arXiv paper the user is viewing, next to the paper's title on its arXiv abstract page.
```

### 权限理由（Permission justification）

storage：

```
Stores the user's consent, an optional OpenAlex API key the user enters in the settings, and citation lookup results for 12 hours so the same paper is not looked up again on every visit. Nothing is synced or sent to the developer.
```

主机权限 / 内容脚本（如果后台要求填写）：

```
The content script runs only on arXiv abstract pages (https://arxiv.org/abs/* and https://www.arxiv.org/abs/*). It reads the paper's arXiv ID, title and author names from the page's metadata and inserts the citation badge next to the title. Lookups go to api.openalex.org, which allows cross-origin requests, so no extra host permission is requested.
```

### 远程代码（Remote code）

选「No, I am not using remote code」。所有脚本都在压缩包里，网络请求只取 OpenAlex 的 JSON 数据，不执行任何下载来的代码。

### 数据使用（Data usage）

勾选收集的数据类型：

- ☑ 网站内容（Website content）：从 arXiv 页面读取论文编号、标题、作者名，编号和标题发给 OpenAlex
- ☑ 身份验证信息（Authentication information）：用户可选填写的 OpenAlex API key，存在本机，只发给 OpenAlex

其余类型都不勾。网页浏览记录（Web history）这一项没有勾：插件不收集浏览记录列表，只在你打开某篇论文的页面时查这一篇。这一点隐私政策里写明了。如果审核员认为应该勾，按要求补勾即可，不需要改代码。

三项承诺全部勾选：

- ☑ 不会出于已获批准的用途之外的目的，向第三方出售或传输用户数据
- ☑ 不会出于与插件单一用途无关的目的使用或传输用户数据
- ☑ 不会为了确定信用度或用于贷款目的而使用或传输用户数据

### 隐私权政策网址

```
https://github.com/Li-Evan/arxiv-citations/blob/main/PRIVACY.md
```

## 分发（Distribution）

- 付款：免费
- 公开范围：公开（Public）
- 地区：所有地区（All regions）

## 测试说明（Test instructions）

```
No account or login is needed.
1. After installing, a welcome page opens. Click "Agree and start".
2. Open https://arxiv.org/abs/1512.03385. A badge such as "Cited by 292,847 · 2 versions merged" appears next to the title within a few seconds.
3. Settings open from the toolbar (puzzle-piece icon > Citation Counts for arXiv). An OpenAlex API key is optional and not needed for review.
If OpenAlex is temporarily rate-limiting anonymous requests, the badge says "not merged" or shows a warning with the reason; reloading the page later retries.
```
