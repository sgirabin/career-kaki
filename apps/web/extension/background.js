chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'career-kaki-start',
    title: 'CareerKaki: Start workflow',
    contexts: ['selection']
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'career-kaki-start') {
    const selection = info.selectionText || '';
    try {
      const res = await fetch('http://localhost:3001/api/workflows/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: selection })
      });
      const data = await res.json();
      console.log('Started workflow', data);
      // Notify the user via clipboard copy of id
      if (data.id) {
        await navigator.clipboard.writeText(data.id).catch(() => {});
      }
      // Optionally open the local demo page
      chrome.tabs.create({ url: 'http://localhost:3001' });
    } catch (err) {
      console.error('Extension start error', err);
    }
  }
});
