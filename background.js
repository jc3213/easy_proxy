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

chrome.runtime.onMessage.addListener(setEasyProxy);

init((storage, pac) => {
    setEasyProxy(pac);
});
