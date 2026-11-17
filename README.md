# arXiv 引用次数 · Citation Counts for arXiv

**English:** A Chrome extension that shows how many times an arXiv paper has been cited, right next to its title on the abstract page. Counts come from [OpenAlex](https://openalex.org), with preprint and published versions merged. It sends only the paper's arXiv ID and title to OpenAlex, and only after you agree on its welcome page. See the [privacy policy](PRIVACY.md). The interface is in English, or Simplified Chinese when Chrome is set to it. Not affiliated with arXiv or OpenAlex.

---

打开 arXiv 论文摘要页（`arxiv.org/abs/...`），标题右边会多一个徽标，显示这篇论文被引用了多少次。点徽标能打开 OpenAlex 上「引用了这篇论文的论文」列表。界面跟着浏览器语言走：简体中文显示中文，其他语言显示英文。

## 安装

上架 Chrome 应用商店之前，用开发者模式加载：

1. Chrome 地址栏打开 `chrome://extensions`
2. 右上角打开「开发者模式」
3. 点「加载已解压的扩展程序」，选这个 `arxiv-citations` 文件夹

装好后会自动打开一个说明页，写清楚插件会发送哪些数据。点「同意并开始使用」之前，插件不发任何请求，arXiv 页面上的徽标只显示「被引 · 点击启用」。

改了代码以后，回到 `chrome://extensions` 点这个插件的刷新按钮，再刷新 arXiv 页面。

## 隐私

插件只把论文的 arXiv 编号和标题发给 OpenAlex，作者名只在本机比对，作者没有服务器，不收集任何数据。完整说明见 [PRIVACY.md](PRIVACY.md)。设置页可以随时撤回同意，撤回后立刻停止请求，并清除本机缓存的查询结果。

## 设置：填 OpenAlex key（可选）

不填也能用。不带 key 时 OpenAlex 的搜索常被限流，徽标上会出现「未合并」。填一个免费 key 后，每天有 1 美元额度，也不受匿名限流影响。

1. 在 [openalex.org](https://openalex.org/signup) 注册，去邮箱点激活链接
2. 在 [Settings → API key](https://openalex.org/settings/api-key) 复制 key
3. 点浏览器右上角拼图图标里的「arXiv 引用次数」，弹出设置页（也可以在 `chrome://extensions` 里点「详细信息 → 扩展程序选项」），粘贴 key，点「校验并保存」

保存前插件会先拿 key 查一篇论文，确认能用才保存，并显示每天额度和今天还剩多少，这次查询不花额度。key 不对（401）、没激活（403）、OpenAlex 限流（429）都会说明原因，不保存。保存后，打开着的 arXiv 页面里没查成功的徽标会自动重查。

key 只存在这台电脑的浏览器里（`chrome.storage.local`），只通过 `Authorization: Bearer` 请求头发给 api.openalex.org，不写进网址。界面上只显示尾号。

## 数字是怎么算出来的

数据来自 [OpenAlex](https://openalex.org)。它有个坑：同一篇论文的 arXiv 预印本和正式发表版本，常常是两条不同的记录。只按 arXiv 编号查，正式发表过的老论文会少算很多。

拿 ResNet（`arxiv.org/abs/1512.03385`）走一遍：

1. 读页面里的 `citation_arxiv_id` 元信息，得到 `1512.03385`，按 DOI `10.48550/arXiv.1512.03385` 查 OpenAlex，拿到 arXiv 那条记录 `W2949650786`，被引 13,192。
2. 用这条记录的标题去搜 OpenAlex，结果里只留下标题完全一样、并且至少有一位作者同姓的记录，找到 CVPR 2016 版 `W2194775991`，被引 243,677。同名但作者不同的书章、博客不会被合并进来。
3. 查 `works?filter=cites:W2194775991|W2949650786`，统计引用了其中任何一个版本的论文共多少篇。两个版本都引用的只算一次，得到约 253,000，显示在徽标上，旁边标「合并 2 个版本」。

鼠标悬停在徽标上，能看到每个版本各自的数字和数据时间。

## 跟 Google Scholar 对不上

OpenAlex 的数字通常比 Google Scholar 小，因为两家收录的引用来源不一样。比如《Attention Is All You Need》在 OpenAlex 只有一条记录，被引 136,431，Google Scholar 上的数字要大得多。Google Scholar 没有公开接口，插件拿不到它的数。

Semantic Scholar 也试过：不带 key 时共享限流，2026-11-16 实测 10 次请求只成功 1 次，所以没用它。

## 免费额度和限流

OpenAlex 不需要注册。不带 key 时，同一个网络出口 IP 每天共用 0.1 美元额度。按编号查单篇不花钱，查一篇新论文约 0.0011 美元（标题搜索 0.001 加合并统计 0.0001）。同一篇论文的结果缓存 12 小时，刷新页面不会重复查。

更常碰到的是搜索限流：2026-11-16 晚上 OpenAlex 搜索集群负载高，不带 key 的标题搜索时好时坏地返回 429，单个请求也要 4 到 8 秒。插件因此这样处理：

1. 按编号查到就先显示数字，这一步不走搜索。
2. 后台再按标题找其他版本，徽标上挂「查找其他版本…」。
3. 搜索返回 429 并要求等 60 秒以内的，自动等完再试一次；还不行就保留数字、标「未合并」，悬停能看到 OpenAlex 的原话。没合并成功的结果不缓存，下次刷新重新试。
4. 单个请求最多等 20 秒，超时就报超时。

OpenAlex 的 429 提示说，用免费 key（每天 1 美元额度）可以不受匿名搜索限流影响。在设置页填 key 的方法见上面的「设置」一节。

## 徽标的几种状态

| 显示 | 意思 | 点击 |
|------|------|------|
| `被引 · 点击启用` | 还没同意发送数据，一个请求都没发 | 打开说明页 |
| `被引 …` | 正在查 | — |
| `被引 253,567 合并 2 个版本` | 查到了 | 打开引用列表 |
| `被引 13,192 查找其他版本…` | 已按编号查到数字，正在后台找同一论文的其他发表版本 | 打开引用列表 |
| `被引 13,192 未合并` | 找其他版本失败（多半是搜索限流），数字只算了 arXiv 这一条，悬停看原因 | 打开引用列表 |
| `被引 未收录` | OpenAlex 还没收录，新论文一般要几天到两周 | 重新查询 |
| `被引 ⚠` | 连编号查询都失败了，悬停能看到原因（限流、超时、key 失效、网络错误等），需要处理时会写明去设置页 | 重试 |

## 测试

```bash
node test/e2e.mjs
```

脚本用本机 Playwright 缓存里的 Chrome for Testing，无头加载插件，检查 29 种情况。

- 文案：中英两份文案条目一致，代码里用到的每条文案都存在。
- 同意流程：装好后自动打开说明页；同意前不发请求、徽标提示启用；点徽标打开说明页；点同意后打开着的页面自动查询；撤回同意后清空缓存、所有页面回到「点击启用」。
- 徽标：新论文、刷新走缓存、2611.15754（曾经一直转圈）、ResNet 合并版本、编号未收录时按标题找到其他版本、先出数字再后台合并、搜索 429 后自动重试、搜索长时间限流时标未合并、完全查不到、编号查询 429、点击重试。
- 设置页：假 key 被真实 OpenAlex 以 401 拒绝且不保存、匿名限流时徽标提示去填 key、能用的 key 保存后显示额度和尾号、保存后打开着的页面自动重查且请求都带 key 而网址里没有 key、已保存的 key 失效时徽标提示、清除 key。
- 英文界面：说明页、徽标、报错提示、设置页都是英文，页面里没有中文。macOS 上 Chrome 按系统语言挑插件文案，命令行参数改不了，所以测英文时复制一份插件并删掉 `zh_CN` 文案，Chrome 就退回默认的英文。

全程不弹窗。OpenAlex 正常时约 1 分钟跑完，限流时要等 Retry-After，可能要几分钟。某一项等待超时会打印徽标当时的状态，记为失败后继续跑。截图默认存到系统临时目录下的 `arxiv-citations-e2e/`，可以用 `OUT_DIR` 改。`EXT_DIR` 可以指定要测的插件目录，上架前用它测打包产物。

## 上架 Chrome 应用商店

- 打包：`sh scripts/package.sh`，产物在 `dist/`，只含插件运行需要的文件
- 步骤：[store/PUBLISHING.md](store/PUBLISHING.md)
- 后台每一栏的填写内容：[store/listing.md](store/listing.md)
- 图标和宣传图：`node store/make-assets.mjs`；商店截图：`node store/make-screenshots.mjs`

## 文件

- `manifest.json`：插件清单，只要 `storage` 权限，内容脚本只在 `arxiv.org/abs/*` 上运行
- `content.js`、`content.css`：读页面元信息、查 OpenAlex（有 key 就带上）、缓存、插入徽标；没同意前只显示「点击启用」
- `background.js`：装好或升级后还没同意就打开说明页；处理徽标上的「点击启用」
- `welcome.html`、`welcome.js`：首次使用说明和同意页
- `options.html`、`options.js`：设置页，工具栏弹窗和「扩展程序选项」共用；同意状态、撤回同意、OpenAlex key
- `i18n.js`、`_locales/`：中英文案，占位符写成 `{name}`
- `page.css`：说明页和设置页共用样式
- `icons/`：插件图标，由 `store/art/icon.svg` 导出
- `PRIVACY.md`：隐私政策（中英文）
- `test/e2e.mjs`、`test/browser.mjs`：端到端测试和共用的浏览器启动工具
- `store/`：商店文案、上架步骤、出图脚本和图片
