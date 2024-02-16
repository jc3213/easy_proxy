var easyDefault = {
    proxies: [],
    fallback: null
};
var easyStorage;
var easyPAC;
var easyFallback = '';
var easyHistory = {};
chrome.runtime.onMessage.addListener(({action, params}, {tab}, response) => {
    switch (action) {
        case 'options_plugins':
            response({storage: easyStorage, pac_script: easyPAC});
            break;
        case 'options_onchange':
            easyOptionChanges(params);
            response({pac_script: easyPAC});
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
        return console.log('Error occurred: ' + host + '\n' + error);
    }
    if (error === 'net::ERR_FAILED' || host in easyHistory) {
        return;
    }
    easyFallback += ` ${host}`;
    easyHistory[host] = host;
    setEasyProxy(convertJsonToPAC(easyStorage, easyFallback));
    console.log('Proxy fallback: ' + host);
}, {urls: ["<all_urls>"]});

chrome.storage.sync.get(null, (json) => {
    easyStorage = {...easyDefault, ...json};
    easyPAC = convertJsonToPAC(easyStorage);
    setEasyProxy(easyPAC);
});

function convertJsonToPAC(json, fallback, pac = '') {
    json.proxies.forEach((proxy) => {
        if (json[proxy] !== '') {
            var regexp = convertRegexp(json[proxy]);
            pac += ' if (/' + regexp + '/i.test(host)) { return "' + proxy + '"; }';
        }
    });
    if (fallback) {
        pac += ' if (/^(' + convertRegexp(fallback) + ')$/.test(host)) { return "' + json.fallback + '; }';
    }
    return 'function FindProxyForURL(url, host) {' + pac + ' return "DIRECT"; }';
}

function convertRegexp(string) {
    return '^(' + string.replace(/[\s;\n]+/g, '|').replace(/\./g, '\\.').replace(/\*/g, '.*') + ')$';
}

function setEasyProxy(data) {
    chrome.proxy.settings.set({
        value: {
            mode: "pac_script",
            pacScript: {data}
        },
        scope: 'regular'
    });
}

function easyOptionChanges({storage, removed}) {
    easyStorage = storage;
    easyPAC = convertJsonToPAC(storage);
    setEasyProxy(convertJsonToPAC(storage, easyFallback));
    chrome.storage.sync.set(storage);
    chrome.storage.sync.remove(removed);
}
