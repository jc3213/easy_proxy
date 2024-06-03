importScripts('/libs/matchpattern.js', 'background.js');

chrome.commands.onCommand.addListener((command) => {
    switch (command) {
        case 'persistent_mode':
            easyProxyMV3Persistent();
            break;
    }
});

async function easyProxyMV3Persistent() {
    var storage = await chrome.storage.local.get(null);
    if (storage.persistent) {
        clearInterval(easyPersistent);
        chrome.action.setBadgeText({text: ''});
        storage.persistent = false;
    }
    else {
        persistentModeEnabled();
        storage.persistent = true;
    }
    chrome.storage.local.set(storage);
}

chrome.storage.local.get(null).then((json) => {
    if (json.persistent) {
        persistentModeEnabled()
    }
});

function persistentModeEnabled() {
    easyPersistent = setInterval(chrome.runtime.getPlatformInfo, 26000);
    chrome.action.setBadgeText({text: 'M'});
    chrome.action.setBadgeBackgroundColor({color: '#f8c'});
}
