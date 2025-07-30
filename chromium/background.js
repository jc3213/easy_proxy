let easyDefault = {
    mode: 'autopac',
    preset: undefined,
    network: false,
    persistent: false,
    action: 'none',
    handler: [ 'net::ERR_CONNECTION_REFUSED', 'net::ERR_CONNECTION_RESET', 'net::ERR_CONNECTION_TIMED_OUT', 'net::ERR_NAME_NOT_RESOLVED' ],
    proxies: [],
    exclude: []
};
let easyColor = {
    direct: '#2940D9',
    autopac: '#C1272D',
    global: '#208020'
};

let easyStorage = {};
let easyHandler;
let easyNetwork;
let easyAction;
let easyMatch = {};
let easyTempo = {};
let easyExclude = new MatchPattern();
let easyRegExp;
let easyMode;
let easyScript;
let easyPersistent;
let easyTabs = new Set();
let easyInspect = {};

let manifest = chrome.runtime.getManifest().manifest_version;
let firefox = typeof browser !== 'undefined';
if (manifest === 3) {
    importScripts('libs/matchpattern.js');
}

function easyStorageUpdated(json) {
    let invalid = [];
    Object.keys(json).forEach((key) => {
        if (key in easyDefault) {
            return;
        }
        if (!json.proxies.includes(key)) {
            delete json[key];
            invalid.push(key);
            return;
        }
        if (easyStorage.proxies.includes(key)) {
            easyMatch[key].new(json[key]);
        } else {
            easyMatch[key] = new MatchPattern();
            easyTempo[key] = new MatchPattern();
            easyMatch[key].proxy = key;
            easyTempo[key].proxy = key;
        }
    });
    let removed = easyStorage.proxies.filter((proxy) => {
        if (!json[proxy]) {
            delete easyMatch[proxy];
            delete easyTempo[proxy];
            return true;
        }
    });
    MatchPattern.delete(removed);
    chrome.storage.local.remove([...invalid, ...removed]);
    chrome.storage.local.set(json);
    easyStorage = json;
    easyStorageInit(json);
}

function easyManageQuery(tabId) {
    let match = {}
    let tempo = {};
    let {proxies, mode, preset} = easyStorage;
    let inspect = easyInspect[tabId];
    if (!inspect) {
        return { match, tempo, rule: [], host: [], flag: [], proxies, mode, preset };
    }
    proxies.forEach((proxy) => {
        match[proxy] = easyMatch[proxy].data;
        tempo[proxy] = easyTempo[proxy].data;
    });
    let {rule, host, flag} = inspect;
    return { match, tempo, rule: [...rule], host: [...host], flag: [...flag], proxies, mode, preset };
}

function easyManageUpdated({add, remove, proxy, tabId}) {
    easyMatchPattern(easyMatch, {add, remove, proxy, tabId});
    easyStorage[proxy] = easyMatch[proxy].data;
    chrome.storage.local.set(easyStorage);
}

function easyMatchPattern(list, {add = [], remove = [], proxy, tabId}) {
    let matchpattern = list[proxy];
    matchpattern.add(add);
    matchpattern.delete(remove);
    easyProxyScript();
    chrome.tabs.update(tabId, {url: easyInspect[tabId].url});
}

function easyTempoPurged(tabId) {
    easyStorage.proxies.forEach((proxy) => easyTempo[proxy].empty());
    easyProxyScript();
    chrome.tabs.update(tabId, {url: easyInspect[tabId].url});
}

function easyModeChanger(params) {
    easyStorage.mode = params;
    chrome.storage.local.set(easyStorage);
    easyProxyMode();
}

chrome.runtime.onMessage.addListener(({action, params}, sender, response) => {
    switch (action) {
        case 'storage_query': 
            response({ storage: easyStorage, manifest });
            break;
        case 'storage_update':
            easyStorageUpdated(params);
            break;
        case 'pacscript_query':
            response(easyMatch[params].pac_script);
            break;
        case 'manager_query':
            response(easyManageQuery(params));
            break;
        case 'manager_update':
            easyManageUpdated(params);
            break;
        case 'manager_tempo':
            easyMatchPattern(easyTempo, params);
            break;
        case 'manager_purge':
            easyTempoPurged(params);
            break;
        case 'easyproxy_mode':
            response(easyModeChanger(params));
            break;
    };
});

function firefoxScheme(scheme, url) {
    switch (scheme) {
        case 'HTTP':
            return { http: 'http://' + url };
        case 'HTTPS':
            return { ssl: 'https://' + url };
        case 'SOCKS':
            return { socks: 'socks://' + url, socksVersion: 4 };
        case 'SOCKS5':
            return { socks: 'socks://' + url, socksVersion: 5 };
    };
}

function firefoxHandler(mode) {
    switch (mode) {
        case 'autopac':
            return { proxyType: 'autoConfig', autoConfigUrl: 'data:,' + easyScript };
        case 'direct':
            return { proxyType: 'none' };
        case 'global':
            let proxy = easyStorage.preset ?? easyStorage.proxies[0];
            let [scheme, url] = proxy.split(' ');
            let config = firefoxScheme(scheme, url);
            return { proxyType: 'manual', passthrough: 'localhost, 127.0.0.1', ...config };
    };
}

function chromiumHandler(mode) {
    switch (mode) {
        case 'autopac':
            return { mode: 'pac_script', pacScript: { data: easyScript } };
        case 'direct':
            return { mode: 'direct' };
        case 'global':
            let proxy = easyStorage.preset ?? easyStorage.proxies[0];
            let [scheme, host, port] = proxy.split(/[\s:]/);
            let singleProxy = { scheme: scheme.toLowerCase(), host, port: port | 0 };
            return { mode: 'fixed_servers', rules: { singleProxy, bypassList: ['localhost', '127.0.0.1'] } };
    };
}

function easyProxyMode() {
    let {mode} = easyStorage;
    let color = easyColor[mode];
    let value = firefox ? firefoxHandler(mode) : chromiumHandler(mode);
    easyMode = mode;
    chrome.proxy.settings.set({ value });
    chrome.action.setBadgeBackgroundColor({ color });
}

chrome.action ??= chrome.browserAction;

chrome.tabs.onRemoved.addListener((tabId) => {
    delete easyInspect[tabId];
});

chrome.tabs.onUpdated.addListener((tabId, {status}, {url}) => {
    switch (status) {
        case 'loading':
            if (url.startsWith('http') && !easyTabs.has(tabId)) {
                easyTabs.add(tabId);
                let {host, rule} = easyMatchInspect('manager_update', tabId, url);
                easyInspect[tabId] = { rule: new Set([rule]), host: new Set([host]), flag: new Set(), index: 0, url };
            }
            break;
        case 'complete':
            easyTabs.delete(tabId);
            break;
    };
});

chrome.webRequest.onBeforeRequest.addListener(({tabId, type, url}) => {
    let inspect = easyInspect[tabId] ??= { rule: new Set(), host: new Set(), flag: new Set(), index: 0 };
    let {host, rule} = easyMatchInspect('manager_update', tabId, url);
    inspect.rule.add(rule);
    inspect.host.add(host);
    if (easyNetwork) {
        inspect.index = easyNetworkCounter(tabId, inspect.index, host);
    }
}, {urls: [ 'http://*/*', 'https://*/*' ]});

chrome.webRequest.onErrorOccurred.addListener(({tabId, error, url}) => {
    if (!easyHandler.has(error)) {
        return;
    }
    let { preset } = easyStorage;
    if (!preset) {
        return;
    }
    let { host, rule } = easyMatchInspect('manager_report', tabId, url);
    switch(easyAction) {
        case 'none':
            let { flag } = easyInspect[tabId];
            flag.add(rule);
            flag.add(host);
            break;
        case 'match':
            easyMatchAction('manager_to_match', easyMatch[preset], tabId, host);
            break;
        case 'tempo':
            easyMatchAction('manager_to_tempo', easyTempo[preset], tabId, host);
            break;
    };
}, {urls: [ 'http://*/*', 'https://*/*' ]});

function easyMatchAction(action, proxy, tabId, host) {
    if (!easyExlude.test(host)) {
        proxy.add(host);
        easyProxyScript();
        chrome.runtime.sendMessage({action, params: { tabId, host }});
    }
}

function easyMatchInspect(action, tabId, url) {
    let host = url.match(/^(?:(?:http|ftp|ws)s?:?\/\/)?(([^./:]+\.)+[^./:]+)(?::\d+)?\/?/)[1];
    let rule = MatchPattern.make(host);
    chrome.runtime.sendMessage({action, params: { tabId, rule, host }});
    return {host, rule};
}

function easyNetworkCounter(tabId, index, host) {
    if (easyMode === 'direct' || !easyRegExp.test(host)) {
        return 0;
    }
    chrome.action.setBadgeText({tabId, text: String(++index)});
    return index;
}

chrome.storage.local.get(null, async (json) => {
    easyStorage = {...easyDefault, ...json};
    easyStorage.proxies.forEach((proxy) => {
        let match = new MatchPattern();
        let tempo = new MatchPattern();
        match.proxy = tempo.proxy = proxy;
        match.new(easyStorage[proxy]);
        easyMatch[proxy] = match;
        easyTempo[proxy] = tempo;
    });
    easyStorageInit(easyStorage);
});

function easyStorageInit(json) {
    easyNetwork = json.network;
    easyHandler = new Set(json.handler);
    easyAction = json.action;
    easyExclude.new(json.exclude);
    easyProxyScript();
    if (manifest === 3 && json.persistent) {
        easyPersistent = setInterval(chrome.runtime.getPlatformInfo, 26000);
    } else {
        clearInterval(easyPersistent);
    }
}

function easyProxyScript() {
    let result = MatchPattern.combine();
    easyScript = result.pac_script;
    easyRegExp = result.regexp;
    easyProxyMode();
}
