importScripts('/libs/core.js');

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

chrome.runtime.onMessage.addListener(({action, params}, {tab}, response) => {
    switch (action) {
        case 'options_onchange':
            easyStorage = params;
            setEasyProxy(convertJsonToPAC(params, easyFallback));
            break;
    }
});

chrome.action.onClicked.addListener((tab) => {
    chrome.runtime.openOptionsPage();
});

chrome.webRequest.onErrorOccurred.addListener(({url, tabId, error}) => {
    if (error === 'net::ERR_BLOCKED_BY_CLIENT') {
        return;
    }
    var {host} = new URL(url);
    if (!easyStorage.fallback) {
        return console.log(`Error occurred: ${host}\n${error}`);
    }
    if (error === 'net::ERR_FAILED' || easyFallback.includes(host)) {
        return;
    }
    easyFallback += ` ${host}`;
    setEasyProxy(convertJsonToPAC(easyStorage, easyFallback));
    console.log(`Proxy fallback: ${host}`);
}, {urls: ["<all_urls>"]});

chrome.storage.sync.get(null, (json) => {
    easyProxyStorage(json);
    setEasyProxy(easyPAC);
});
