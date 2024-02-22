var easyDefault = {
    schemes: [],
    servers: [],
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

function easyOptionChanges({storage, removed = []}) {
    easyStorage = storage;
    easyPAC = convertJsonToPAC(storage);
    setEasyProxy(convertJsonToPAC(storage, easyFallback));
    chrome.storage.sync.set(storage);
    if (removed.length !== 0) {
        chrome.storage.sync.remove(removed);
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
    easyFallback += ` ${host}`;
    easyHistory[host] = host;
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
    var {schemes, servers, total} = json;
    for (var i = 0; i < total; i ++) {
        var proxy = schemes[i] + ' ' + servers[i];
        var matches = json[i];
        if (matches !== '') {
            pac += ' if (/' + convertRegexp(matches) + '/i.test(host)) { return "' + proxy + '"; }';
        }
    }
    if (fallback) {
        pac += ' if (/^(' + convertRegexp(fallback) + ')$/.test(host)) { return "' + json.fallback + '; }';
    }
    return 'function FindProxyForURL(url, host) {' + pac + ' return "DIRECT"; }';
}

function convertRegexp(string) {
    return '^(' + string.replace(/[\s;\n]+/g, '|').replace(/\./g, '\\.').replace(/\*/g, '.*') + ')$';
}

chrome.runtime.onInstalled.addListener(async ({previousVersion}) => {
    if (previousVersion <= '0.2.0') {
        var json = await chrome.storage.sync.get(null);
        var total = 0;
        var temp = {schemes: [], servers: []};
        temp.fallback = json.fallback;
        json.proxies.forEach((proxy) => {
            var [scheme, server] = proxy.split(' ');
            temp.schemes.push(scheme);
            temp.servers.push(server);
            temp[total] = json[proxy];
            total ++;
        });
        temp.total = total;
        console.log(temp);
        easyStorage = temp;
        easyPAC = convertJsonToPAC(temp);
        setEasyProxy(easyPAC);
        chrome.storage.local.set(easyStorage);
        chrome.storage.sync.clear();
    }
});
