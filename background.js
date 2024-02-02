importScripts('/libs/converter.js');

var easyDefault = {
    proxies: []
};

function setNewProxy(data) {
    chrome.proxy.settings.set({
        value: {
            mode: "pac_script",
            pacScript: {data}
        },
        scope: 'regular'
    }, () => {
        console.log(data);
    });
}

chrome.runtime.onMessage.addListener(setNewProxy);

chrome.action.onClicked.addListener((tab) => {
    chrome.runtime.openOptionsPage();
});

chrome.storage.sync.get(null, (json) => {
    easyStorage = {...easyDefault, ...json};
    setNewProxy(convertJsonToPAC(easyStorage));
});
