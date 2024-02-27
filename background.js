var easyDefault = {
    proxies: [],
    fallback: null
};
var easyStorage = {};
var easyPAC = '';
var neoPAC = '';
var easyProxy;
var easyHistory = {};
var easyFallback = [];
var easyMatches = [];

chrome.runtime.onMessage.addListener(({action, params}, {tab}, response) => {
    switch (action) {
        case 'options_plugins':
            response({storage: {...easyDefault, ...easyStorage}, pac_script: easyPAC});
            break;
        case 'options_onchange':
            easyOptionsChanges(params, response);
            break;
        case 'easyproxy_temporary':
            easyTempoProxy(params);
            break;
    }
});

function easyOptionsChanges({storage, removed = []}, response) {
    easyStorage = storage;
    easyProxy = storage.fallback;
    pacScriptConverter();
    response({pac_script: easyPAC});
    setEasyProxy(neoPAC);
    chrome.storage.local.set(storage);
    if (removed.length !== 0) {
        chrome.storage.local.remove(removed);
    }
}

function easyTempoProxy({proxy, matches}) {
    easyMatches.push({proxy, matches});
    console.log('Proxy server: ' + proxy + '\nTempo: ' + matches.join(' '));
    pacScriptConverter();
    setEasyProxy(neoPAC);
}

chrome.webRequest.onErrorOccurred.addListener(({url, tabId, error}) => {
    if (error === 'net::ERR_BLOCKED_BY_CLIENT') {
        return;
    }
    var {host} = new URL(url);
    if (!easyProxy) {
        return console.log('Error occurred: ' + host + '\n' + error);
    }
    if (error === 'net::ERR_FAILED' || host in easyHistory) {
        return;
    }
    easyHistory[host] = host;
    easyFallback.push(host);
    pacScriptConverter();
    setEasyProxy(neoPAC);
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
    easyProxy = easyStorage.fallback;
    pacScriptConverter();
    setEasyProxy(easyPAC);
});

function pacScriptConverter(pac_script = '') {
    easyStorage.proxies.forEach((proxy) => {
        if (easyStorage[proxy].length !== 0) {
            pac_script += ' if (/' + convertRegexp(easyStorage[proxy]) + '/i.test(host)) { return "' + proxy + '"; }';
        }
    });
    easyPAC = 'function FindProxyForURL(url, host) {' + pac_script + ' return "DIRECT"; }';
    easyMatches.forEach(({proxy, matches}) => {
        pac_script += ' if (/' + convertRegexp(matches) + '/i.test(host)) { return "' + proxy + '"; }';
    });
    if (easyProxy && easyFallback.length !== 0) {
        pac_script += ' if (/' + convertRegexp(easyFallback) + '/i.test(host)) { return "' + easyStorage.fallback + '"; }';
    }
    neoPAC = 'function FindProxyForURL(url, host) {' + pac_script + ' return "DIRECT"; }';
}

function convertRegexp(array) {
    return '^(' + array.join('|').replace(/\./g, '\\.').replace(/\*/g, '.*') + ')$';
}

chrome.runtime.onInstalled.addListener(async ({previousVersion}) => {
    if (previousVersion <= '0.2.0') {
        var json = await chrome.storage.sync.get(null);
        json.proxies.forEach((proxy) => json[proxy] = json[proxy].split(' '));
        easyStorage = json;
        pacScriptConverter();
        setEasyProxy(neoPAC);
        chrome.storage.local.set(easyStorage);
        chrome.storage.sync.clear();
    }
});
