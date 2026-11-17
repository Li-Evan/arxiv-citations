# Privacy Policy — Citation Counts for arXiv

Effective date: 2026-11-17 · [中文版本见下方](#隐私政策arxiv-引用次数)

Citation Counts for arXiv ("the extension") shows how many times an arXiv paper has been cited, next to its title on arXiv abstract pages. The citation data comes from [OpenAlex](https://openalex.org).

## Nothing is sent before you agree

After installation the extension opens a welcome page that explains what it sends. It makes no network requests until you click "Agree and start". Until then, the badge on arXiv pages only says "Citations · click to enable".

## What data the extension handles

| Data | Where it comes from | What happens to it | How long it is kept |
|------|---------------------|--------------------|---------------------|
| arXiv ID and title of the paper you are viewing | The metadata of the arXiv abstract page you open (`arxiv.org/abs/…`) | Sent over HTTPS to the OpenAlex API (`api.openalex.org`) to find the paper and its citation count | Not stored apart from the lookup result below |
| Author names of that paper | The same page | Used only on your computer, to tell whether two OpenAlex records are versions of the same paper. Never sent anywhere | Not stored |
| Lookup results (citation counts, OpenAlex record IDs, venue and year of each version, time of the lookup) | OpenAlex's responses | Stored in Chrome's extension storage (`chrome.storage.local`) on your computer, so the same paper is not looked up again for 12 hours | Until replaced by a newer lookup, until you withdraw consent, or until you uninstall the extension |
| OpenAlex API key (optional) | You type it into the extension's settings | Stored in `chrome.storage.local`. Sent only to `api.openalex.org`, over HTTPS, in the `Authorization` request header, never in a URL | Until you remove it in settings or uninstall the extension |
| Your consent (date and time you agreed) | The welcome page | Stored in `chrome.storage.local` | Until you withdraw consent or uninstall the extension |

## Who receives data

Only OpenAlex. Like any website you visit, OpenAlex receives your IP address along with each request. OpenAlex's own privacy policy is at <https://openalex.org/privacy>.

The developer of the extension runs no server and receives no data from it. The extension contains no analytics, no advertising and no tracking. Data is not sold, not transferred to anyone else, and not used for any purpose other than showing citation counts.

Clicking a badge opens a list of citing papers on openalex.org in a new tab; that is ordinary browsing between you and OpenAlex.

## What the extension does not do

- It runs only on arXiv abstract pages (`https://arxiv.org/abs/*`) and on its own settings and welcome pages. It reads nothing on other websites.
- It does not read your browsing history, cookies, bookmarks or other tabs.

## Security

All network requests use HTTPS. Data on your computer is kept in Chrome's extension storage, which is protected in the same way as the rest of your Chrome profile; the extension does not add its own encryption on top of it.

## Your choices

- **Withdraw consent:** Settings → "Withdraw consent". The extension stops sending requests immediately and deletes cached lookup results.
- **Remove your API key:** Settings → "Remove saved key".
- **Uninstall:** removing the extension from Chrome deletes everything it stored.

Settings open from the puzzle-piece icon in Chrome's toolbar → Citation Counts for arXiv.

## Limited Use

The extension's use and transfer of information complies with the [Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq), including the Limited Use requirements.

## Changes to this policy

If the extension's data practices change, this page will be updated, and the extension will ask for your consent again before the new practice takes effect.

## Contact

Questions or concerns: open an issue at <https://github.com/Li-Evan/arxiv-citations/issues>.

The extension is not affiliated with arXiv or OpenAlex.

---

# 隐私政策：arXiv 引用次数

生效日期：2026-11-17

「arXiv 引用次数」（下称「插件」）在 arXiv 论文摘要页的标题旁边显示这篇论文被引用的次数。引用数据来自 [OpenAlex](https://openalex.org)。

## 同意之前不发送任何数据

插件装好后会打开一个说明页，写清楚会发送什么。在你点「同意并开始使用」之前，插件不发任何网络请求，arXiv 页面上的徽标只显示「被引 · 点击启用」。

## 插件处理哪些数据

| 数据 | 来自哪里 | 怎么用 | 保留多久 |
|------|---------|-------|---------|
| 你正在看的论文的 arXiv 编号和标题 | 你打开的 arXiv 摘要页（`arxiv.org/abs/…`）里的元信息 | 通过 HTTPS 发给 OpenAlex 接口（`api.openalex.org`），查这篇论文和它的引用次数 | 除下面的查询结果外不另行保存 |
| 这篇论文的作者名 | 同一个页面 | 只在你的电脑上使用，用来判断 OpenAlex 里的两条记录是不是同一篇论文的不同版本，不会发送到任何地方 | 不保存 |
| 查询结果（引用次数、OpenAlex 记录编号、各版本的发表场合和年份、查询时间） | OpenAlex 的返回 | 存在你电脑上 Chrome 的插件存储（`chrome.storage.local`）里，12 小时内同一篇论文不再重复查询 | 直到被新的查询结果替换、你撤回同意，或卸载插件 |
| OpenAlex API key（可选） | 你在插件设置里填写 | 存在 `chrome.storage.local`；只通过 HTTPS、放在 `Authorization` 请求头里发给 `api.openalex.org`，不写进网址 | 直到你在设置里清除，或卸载插件 |
| 你的同意记录（同意的日期和时间） | 说明页 | 存在 `chrome.storage.local` | 直到你撤回同意，或卸载插件 |

## 谁会收到数据

只有 OpenAlex。和访问任何网站一样，OpenAlex 会随请求看到你的 IP 地址。OpenAlex 自己的隐私政策见 <https://openalex.org/privacy>。

插件作者没有服务器，收不到插件的任何数据。插件里没有统计、广告或追踪代码。数据不出售、不转给任何其他人，也不用于显示引用次数以外的任何用途。

点击徽标会在新标签页打开 openalex.org 上的引用列表，那是你和 OpenAlex 之间的正常浏览。

## 插件不做的事

- 只在 arXiv 摘要页（`https://arxiv.org/abs/*`）和插件自己的设置页、说明页上运行，不读取其他任何网站的内容。
- 不读取你的浏览记录、Cookie、书签或其他标签页。

## 安全

所有网络请求都走 HTTPS。存在你电脑上的数据放在 Chrome 的插件存储里，和 Chrome 用户资料里的其他数据受同样的保护；插件没有在此之上另外加密。

## 你可以做什么

- **撤回同意**：设置 →「撤回同意」。插件立刻停止发送请求，并删除本机缓存的查询结果。
- **清除 API key**：设置 →「清除已保存的 key」。
- **卸载**：从 Chrome 移除插件，会删除它存的所有数据。

设置的打开方式：点 Chrome 工具栏右上角的拼图图标 →「arXiv 引用次数」。

## 有限使用声明

插件对信息的使用和传输符合 [Chrome 应用商店用户数据政策](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)，包括其中的有限使用（Limited Use）要求。

## 政策变更

如果插件的数据做法有变化，会更新本页，并在新做法生效前重新征求你的同意。

## 联系

有问题请在 <https://github.com/Li-Evan/arxiv-citations/issues> 提 issue。

本插件与 arXiv、OpenAlex 均无关联。
