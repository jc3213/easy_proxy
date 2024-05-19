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
        storage.persistent = false;
    }
    else {
        easyPersistent = setInterval(chrome.runtime.getPlatformInfo, 26000);
        storage.persistent = true;
    }
    chrome.storage.local.set(storage);
}

chrome.storage.local.get(null).then((json) => {
    if (storage.persistent) {
        easyPersistent = setInterval(chrome.runtime.getPlatformInfo, 26000);
    }
});
