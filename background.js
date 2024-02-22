var easyDefault = {
    proxies: [],
    fallback: null
};
var easyStorage;
var easyPAC;
var easyHistory = {};
var easyFallback = [];

chrome.runtime.onMessage.addListener(({action, params}, {tab}, response) => {
    switch (action) {
        case 'options_plugins':
            response({storage: easyStorage, pac_script: easyPAC});
            break;
        case 'options_onchange':
            easyOptionChanges(params, response);
            break;
    }
});

function easyOptionChanges({storage, removed = []}, response) {
    easyStorage = storage;
    easyPAC = convertJsonToPAC(storage);
    response({pac_script: easyPAC});
    setEasyProxy(convertJsonToPAC(storage, easyFallback));
    chrome.storage.local.set(storage);
    if (removed.length !== 0) {
        chrome.storage.local.remove(removed);
    }
}

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
    easyHistory[host] = host;
    easyFallback.push(host);
    setEasyProxy(convertJsonToPAC(easyStorage, easyFallback));
    console.log('Proxy fallback: ' + host);
}, {urls: ["<all_urls>"]});

function setEasyProxy(data) {
    chrome.proxy.settings.set({
        value: {
            mode: "pac_script",
            pacScript: {data}
        },
        scope: 'regular'
    });
}

chrome.storage.local.get(null, (json) => {
    easyStorage = {...easyDefault, ...json};
    easyPAC = convertJsonToPAC(easyStorage);
    setEasyProxy(easyPAC);
});

function convertJsonToPAC(json, fallback, pac = '') {
    json.proxies.forEach((proxy) => {
        if (json[proxy] !== '') {
            pac += ' if (/' + convertRegexp(json[proxy]) + '/i.test(host)) { return "' + proxy + '"; }';
        }
    });
    if (fallback) {
        pac += ' if (/^(' + convertRegexp(fallback) + ')$/.test(host)) { return "' + json.fallback + '; }';
    }
    return 'function FindProxyForURL(url, host) {' + pac + ' return "DIRECT"; }';
}

function convertRegexp(array) {
    return '^(' + array.join('|').replace(/\./g, '\\.').replace(/\*/g, '.*') + ')$';
}

chrome.runtime.onInstalled.addListener(async ({previousVersion}) => {
    if (previousVersion <= '0.2.0') {
        var json = await chrome.storage.sync.get(null);
        json.proxies.forEach((proxy) => json[proxy] = json[proxy].split(' '));
        easyStorage = json;
        easyPAC = convertJsonToPAC(storage);
        setEasyProxy(convertJsonToPAC(storage, easyFallback));
        chrome.storage.local.set(easyStorage);
        chrome.storage.sync.clear();
    }
});
