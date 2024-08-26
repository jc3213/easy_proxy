document.querySelectorAll('[i18n]').forEach((node) => {
    node.textContent = chrome.i18n.getMessage(node.getAttribute('i18n'));
});

document.querySelectorAll('[i18n-title]').forEach((node) => {
    node.title = chrome.i18n.getMessage(node.getAttribute('i18n-title'));
});
