# 上架 Chrome 应用商店的步骤

规则来源：Chrome 官方开发者文档（developer.chrome.com/docs/webstore），2026-11-17 核对。每个后台栏位要填的内容都在 [listing.md](listing.md) 里，复制粘贴即可。

## 一、准备（只做一次）

1. **注册开发者账号**：用 Google 账号打开 <https://chrome.google.com/webstore/devconsole>，同意开发者协议，付一次性注册费。金额以付款页面为准，官方文档正文没写具体数字。注册前先在官方的支持国家和地区名单里确认自己所在的地区。
   - 官方建议单独用一个新邮箱注册：账号建好后邮箱不能改，审核和下架通知都发到这个邮箱。
2. **填账号信息**（后台左侧 Account）：
   - 发布者名称（Publisher name）：填 `Evan`。它会公开显示在商店的「提供方」一栏，不要填真名。
   - 联系邮箱：必须验证，而且会公开显示在插件的联系信息里，建议用专门的发布邮箱。
   - 实际地址：只有插件里能买东西或订阅时才需要，这个插件不用填。
3. **声明交易者身份**：欧盟法规要求开发者声明自己是「交易者（Trader）」还是「非交易者（Non-trader）」。官方定义：为了自己的生意、业务或职业而上架的算交易者。免费的个人工具一般选非交易者，选哪个由你自己判断。

## 二、打包和自查

```bash
cd ~/code/chroma-extension/arxiv-citations
sh scripts/package.sh
```

产物是 `dist/arxiv-citations-<版本>.zip`。上传前，用解压出来的这一份跑一遍测试（约 1 分钟，不弹窗）：

```bash
rm -rf /tmp/axc-pkg && mkdir /tmp/axc-pkg && unzip -q dist/arxiv-citations-0.3.0.zip -d /tmp/axc-pkg && EXT_DIR=/tmp/axc-pkg node test/e2e.mjs
```

29 项全部通过再上传。

## 三、上传和填写

1. 后台点「Add new item」，上传 zip。
2. **Store listing（商店信息）**：按 listing.md 填写英文详细说明、类别、截图、小宣传图、主页和支持网址；再在页面顶部语言下拉里选「中文（简体）」，填中文详细说明和中文截图。
3. **Privacy（隐私权规范）**：填单一用途、权限理由；远程代码选「No」；数据使用按 listing.md 勾选；填隐私政策网址。
4. **Distribution（分发）**：免费、公开、所有地区。
5. **Test instructions（测试说明）**：粘贴 listing.md 里的英文说明。
6. 点「Submit for review」提交审核。弹窗里可以选择审核通过后自动发布，也可以取消勾选，审核通过后自己点发布；审核通过后 30 天内要发布，过期会退回草稿。

## 四、审核

- 官方说法：大多数插件几天内审完，最长可能要几周；超过三周还没结果，可以联系开发者支持。
- 新开发者账号最多同时发布 2 个插件，这是第一个，不受影响。
- 如果被拒，邮件里会写违反了哪一条。常见的几类和这个插件已做的对应：
  - 隐私政策缺失或和实际行为不一致：隐私政策、商店数据声明、同意页三处写的是同一套说法。
  - 没有在插件内告知并取得同意：首次安装自动打开说明页，同意前不发任何请求。
  - 权限过多：只申请了 `storage`，内容脚本只匹配 `arxiv.org/abs/*`。

## 五、以后更新版本

1. 改代码，`manifest.json` 里的 `version` 加一（比如 0.3.0 → 0.3.1），商店要求每次上传的版本号比上一次大。
2. 跑 `node test/e2e.mjs`，然后 `sh scripts/package.sh`，再按第二步用解压包复测。
3. 后台打开这个插件，在 Package 页上传新 zip，提交审核。
4. 如果改了数据做法（发送的内容变了、多了接收方），先改 `PRIVACY.md`、`listing.md` 和同意页，并把 `welcome.js` 里同意记录的 `version` 加一、让 `content.js` 只认新版本的同意，让老用户重新同意。
5. 界面变了的话，重新生成截图：`node store/make-screenshots.mjs`。
