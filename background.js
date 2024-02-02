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

chrome.storage.sync.get(null, (json) => {
    easyStorage = {...easyDefault, ...json};
    setNewProxy(convertJsonToPAC(easyStorage));
});

chrome.runtime.onMessage.addListener(setNewProx);
