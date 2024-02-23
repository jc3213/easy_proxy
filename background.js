var easyDefault = {
    proxies: [],
    fallback: null
};
var easyStorage;
var easyPAC;
var easyHistory = {};
var easyFallback = [];
var easyMatches = [];

chrome.runtime.onMessage.addListener(({action, params}, {tab}, response) => {
    switch (action) {
        case 'options_plugins':
            response({storage: easyStorage, pac_script: easyPAC});
            break;
        case 'options_onchange':
            easyOptionChanges(params, response);
            break;
        case 'easyproxy_temporary':
            easyTempoProxy(params);
            break;
    }
});

function easyOptionChanges({storage, removed = []}, response) {
    easyStorage = storage;
    easyPAC = convertJsonToPAC();
    response({pac_script: easyPAC});
    setEasyProxy(convertJsonToPAC({proxy: storage.fallback, matches: easyFallback}));
    chrome.storage.local.set(storage);
    if (removed.length !== 0) {
        chrome.storage.local.remove(removed);
    }
}

function easyTempoProxy({proxy, matches}) {
    easyMatches.push(...matches);
    console.log('Proxy server:\n' + proxy + '\nTempo:\n' + matches.join('\n'));
    setEasyProxy(convertJsonToPAC({proxy, matches}));
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
    setEasyProxy(convertJsonToPAC(easyStorage, {proxy: easyStorage.fallback, matches: easyFallback}));
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
    easyPAC = convertJsonToPAC();
    setEasyProxy(easyPAC);
});

function convertJsonToPAC(extra, pac_script = '') {
    easyStorage.proxies.forEach((proxy) => {
        if (easyStorage[proxy].length !== 0) {
            pac_script += ' if (/' + convertRegexp(easyStorage[proxy]) + '/i.test(host)) { return "' + proxy + '"; }';
        }
    });
    if (extra) {
        pac_script += ' if (/' + convertRegexp(extra.matches) + '/i.test(host)) { return "' + extra.proxy + '"; }';
    }
    return 'function FindProxyForURL(url, host) {' + pac_script + ' return "DIRECT"; }';
}

function convertRegexp(array) {
    return '^(' + array.join('|').replace(/\./g, '\\.').replace(/\*/g, '.*') + ')$';
}

chrome.runtime.onInstalled.addListener(async ({previousVersion}) => {
    if (previousVersion <= '0.2.0') {
        var json = await chrome.storage.sync.get(null);
        json.proxies.forEach((proxy) => json[proxy] = json[proxy].split(' '));
        easyStorage = json;
        easyPAC = convertJsonToPAC();
        setEasyProxy(convertJsonToPAC({proxy: json.fallback, matches: easyFallback}));
        chrome.storage.local.set(easyStorage);
        chrome.storage.sync.clear();
    }
});
