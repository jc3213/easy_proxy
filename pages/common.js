document.querySelectorAll('[i18n]').forEach(item => {
    if (item.title !== '') {
        item.title = chrome.i18n.getMessage(item.title);
        return;
    }
    item.textContent = chrome.i18n.getMessage(item.textContent);
});

if (typeof browser !== 'undefined') {
    chrome.storage.sync = browser.storage.local;
}
