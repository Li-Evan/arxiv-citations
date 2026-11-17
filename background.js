// 装好或升级后还没同意过，就打开同意页；徽标上的「点击启用」也通过这里打开它
chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason !== 'install' && reason !== 'update') return;
  const { consent } = await chrome.storage.local.get('consent');
  if (!consent) chrome.tabs.create({ url: 'welcome.html' });
});

chrome.runtime.onMessage.addListener(msg => {
  if (msg === 'open-welcome') chrome.tabs.create({ url: 'welcome.html' });
});
