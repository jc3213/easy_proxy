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
    }, () => {
        console.debug(data);
    });
}

chrome.action.onClicked.addListener((tab) => {
    chrome.runtime.openOptionsPage();
});

chrome.tabs.onRemoved.addListener((tabId) => {
    delete easyTabLog[tabId];
    delete easyNetwork[tabId];
});

chrome.webRequest.onErrorOccurred.addListener(({url, tabId, error}) => {
    if (easyTabLog[tabId] !== url) {
        easyTabLog[tabId] = url;
        easyNetwork[tabId] = [];
    }
    var {host} = new URL(url);
    var fallback = easyNetwork[tabId];
    if (!fallback.includes(host)) {
        fallback.push(host);
    }
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

chrome.runtime.onMessage.addListener(setEasyProxy);

init((storage, pac) => {
    setEasyProxy(pac);
});
