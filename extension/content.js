window.addEventListener('message', (event) => {
  if (event.source !== window || event.origin !== window.location.origin) {
    return;
  }

  if (event.data?.type !== 'EIGYO_TECHO_IMPORT_RESULT') {
    return;
  }

  chrome.runtime.sendMessage({
    type: 'EIGYO_TECHO_IMPORT_RESULT',
    ok: event.data.ok,
    message: event.data.message,
  });
});
