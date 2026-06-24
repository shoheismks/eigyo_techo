const APP_ORIGIN = 'https://eigyo-techo.vercel.app';
const APP_IMPORT_URL = `${APP_ORIGIN}/import`;
const MENU_ID = 'add-to-eigyo-techo';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: '営業手帳に追加',
    contexts: ['selection'],
  });
});

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== MENU_ID) {
    return;
  }

  const companyName = sanitizeSelection(info.selectionText || '');

  if (!companyName) {
    notify('追加できませんでした', '会社名として使える選択テキストがありません。');
    return;
  }

  try {
    await openAppWithCompanyName(companyName);
    notify('営業手帳を開きました', `「${companyName}」を営業手帳に送信しました。`);
  } catch {
    notify('送信に失敗しました', '営業手帳を開けませんでした。');
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== 'EIGYO_TECHO_IMPORT_RESULT') {
    return;
  }

  notify(
    message.ok ? '営業手帳に追加しました' : '営業手帳に追加できませんでした',
    message.message || '',
  );
});

async function openAppWithCompanyName(companyName) {
  const url = `${APP_IMPORT_URL}?companyName=${encodeURIComponent(companyName)}`;
  const tabs = await chrome.tabs.query({ url: [`${APP_ORIGIN}/*`] });
  const targetTab = tabs[0];

  if (targetTab?.id) {
    await chrome.tabs.update(targetTab.id, { active: true, url });
    return;
  }

  await chrome.tabs.create({ url });
}

function sanitizeSelection(text) {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

function notify(title, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icon.svg'),
    title,
    message,
  });
}
