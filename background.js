importScripts('/libs/core.js');

var easyTabLog = {};
var easyNetwork = {};
var easyFallback = '';

function setEasyProxy(data) {
    chrome.proxy.settings.set({
        value: {
            mode: "pac_script",
            pacScript: {data}
        },
        scope: 'regular'
    });
}

chrome.action.onClicked.addListener((tab) => {
    chrome.runtime.openOptionsPage();
});

chrome.storage.onChanged.addListener((changes) => {
    Object.keys(changes).forEach((key) => {
        var {newValue} = changes[key];
        if (newValue !== undefined) {
            easyStorage[key] = newValue;
        }
    });
    setEasyProxy(convertJsonToPAC(easyStorage, easyFallback));
});

chrome.webRequest.onErrorOccurred.addListener(({url, tabId, error}) => {
    var {host} = new URL(url);
    if (!easyStorage.fallback) {
        return console.log(`Error occurred: ${host}\n${error}`);
    }
    if (easyFallback.includes(host)) {
        return;
    }
    easyFallback += ` ${host}`;
    setEasyProxy(convertJsonToPAC(easyStorage, easyFallback));
    console.log(`Proxy fallback: ${host}`);
}, {urls: ["http://*/*", "https://*/*"]});

init((storage, pac) => {
    setEasyProxy(pac);
});
