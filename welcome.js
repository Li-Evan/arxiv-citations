const $ = id => document.getElementById(id);

function status(text, kind) {
  $('status').textContent = text;
  $('status').className = `status ${kind}`;
}

applyI18n();
document.title = t('welcomeTitle');

$('agree').addEventListener('click', async () => {
  await chrome.storage.local.set({ consent: { version: 1, at: Date.now() } });
  status(t('welcomeAgreed'), 'ok');
});

$('decline').addEventListener('click', async () => {
  await chrome.storage.local.remove('consent');
  status(t('welcomeDeclined'), 'info');
});

chrome.storage.local.get('consent').then(({ consent }) => {
  if (consent) status(t('welcomeAgreed'), 'ok');
});
