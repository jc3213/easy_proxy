let easyDefault = {
    direct: 'autopac',
    indicator: false,
    persistent: false,
    onerror: [ 'net::ERR_CONNECTION_REFUSED', 'net::ERR_CONNECTION_RESET', 'net::ERR_TIMED_OUT', 'net::ERR_NAME_NOT_RESOLVED' ],
    proxies: []
};
let easyColor = {
    direct: '#2940D9',
    autopac: '#C1272D',
    global: '#208020'
};

let easyStorage = {};
let easyError;
let easyMatch = {};
let easyTempo = {};
let easyRegExp;
let easyMode;
let easyScript;
let easyPersistent;
let easyTabs = new Set();
let easyInspect = {};

let manifest = chrome.runtime.getManifest().manifest_version;
let firefox = typeof browser !== 'undefined';
if (manifest === 3) {
    importScripts('libs/storage.js', 'libs/matchpattern.js');
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
            easyMatch[key].empty();
        } else {
            easyMatch[key] = new MatchPattern();
            easyTempo[key] = new MatchPattern();
            easyMatch[key].proxy = key;
            easyTempo[key].proxy = key;
        }
        easyMatch[key].add(json[key]);
    });
    let removed = easyStorage.proxies.filter((proxy) => {
        if (!json[proxy]) {
            delete easyMatch[proxy];
            delete easyTempo[proxy];
            return true;
        }
    });
    MatchPattern.delete(removed);
    easyStorage = json;
    easyError = new Set(json.onerror);
    easyProxyScript();
    persistentModeHandler();
    chrome.storage.local.remove([...invalid, ...removed]);
    chrome.storage.local.set(json);
}

function easyManageQuery(tabId) {
    let match = {}
    let tempo = {};
    let {proxies, direct} = easyStorage;
    let inspect = easyInspect[tabId];
    if (!inspect) {
        return { match, tempo, rule: [], host: [], error: [], proxies, direct };
    }
    proxies.forEach((proxy) => {
        match[proxy] = easyMatch[proxy].data;
        tempo[proxy] = easyTempo[proxy].data;
    });
    let {rule, host, error} = inspect;
    return { match, tempo, rule: [...rule], host: [...host], error: [...error], proxies, direct };
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
    easyProxyMode(params);
    easyStorage.direct = params;
    chrome.storage.local.set(easyStorage);
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

function firefoxScheme(scheme, proxy) {
    switch (scheme) {
        case 'HTTP':
            return { http: 'http://' + proxy };
        case 'HTTPS':
            return { ssl: 'https://' + proxy };
        case 'SOCKS':
            return { socks: 'socks://' + proxy, socksVersion: 4 };
        case 'SOCKS5':
            return { socks: 'socks://' + proxy, socksVersion: 5 };
    };
}

function firefoxHandler(direct) {
    switch (direct) {
        case 'autopac':
            return { proxyType: 'autoConfig', autoConfigUrl: 'data:,' + easyScript };
        case 'direct':
            return { proxyType: 'none' };
        default:
            let [scheme, proxy] = direct.split(' ');
            let config = firefoxScheme(scheme, proxy);
            return { proxyType: 'manual', passthrough: 'localhost, 127.0.0.1', ...config };
    };
}

function chromiumHandler(direct) {
    switch (direct) {
        case 'autopac':
            return { mode: 'pac_script', pacScript: { data: easyScript } };
        case 'direct':
            return { mode: 'direct' };
        default:
            let [scheme, host, port] = direct.split(/[\s:]/);
            let singleProxy = { scheme: scheme.toLowerCase(), host, port: port | 0 };
            return { mode: 'fixed_servers', rules: { singleProxy, bypassList: ['localhost', '127.0.0.1'] } };
    };
}

function easyProxyMode(direct) {
    easyMode = direct;
    let color = easyColor[direct] ?? easyColor.global;
    let value = firefox ? firefoxHandler(direct) : chromiumHandler(direct);
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
                easyInspect[tabId] = { rule: new Set([rule]), host: new Set([host]), error: new Set(), index: 0, url };
            }
            break;
        case 'complete':
            easyTabs.delete(tabId);
            break;
    };
});

chrome.webRequest.onBeforeRequest.addListener(({tabId, type, url}) => {
    let inspect = easyInspect[tabId] ??= { rule: new Set(), host: new Set(), error: new Set(), index: 0 };
    let {host, rule} = easyMatchInspect('manager_update', tabId, url);
    inspect.rule.add(rule);
    inspect.host.add(host);
    if (easyStorage.indicator) {
        inspect.index = easyProxyIndicator(tabId, inspect.index, url);
    }
}, {urls: [ 'http://*/*', 'https://*/*' ]});

chrome.webRequest.onErrorOccurred.addListener(({tabId, error, url}) => {
    if (easyError.has(error)) {
        let { host, rule } = easyMatchInspect('manager_onerror', tabId, url);
        let { error } = easyInspect[tabId];
        error.add(rule);
        error.add(host);
    }
}, {urls: [ 'http://*/*', 'https://*/*' ]});

function easyMatchInspect(action, tabId, url) {
    let host = url.match(/^(?:(?:http|ftp|ws)s?:?\/\/)?(([^./:]+\.)+[^./:]+)(?::\d+)?\/?/)[1];
    let rule = MatchPattern.make(host);
    chrome.runtime.sendMessage({action, params: { tabId, rule, host }});
    return {host, rule};
}

function easyProxyIndicator(tabId, index, url) {
    if (proxyHandlers[easyMode] && !easyRegExp.test(new URL(url).hostname)) {
        return;
    }
    chrome.action.setBadgeText({tabId, text: String(++index)});
    return index;
}

chrome.storage.local.get(null, async (json) => {
    await MatchPattern.fetch();
    easyStorage = {...easyDefault, ...json};
    easyError = new Set(easyStorage.onerror);
    easyStorage.proxies.forEach((proxy) => {
        let match = new MatchPattern();
        let tempo = new MatchPattern();
        match.proxy = tempo.proxy = proxy;
        match.add(easyStorage[proxy]);
        easyMatch[proxy] = match;
        easyTempo[proxy] = tempo;
    });
    easyProxyScript();
    persistentModeHandler();
});

function easyProxyScript() {
    let result = MatchPattern.combine();
    easyScript = result.pac_script;
    easyRegExp = result.regexp;
    easyProxyMode(easyStorage.direct);
}

function persistentModeHandler() {
    if (manifest === 3 && easyStorage.persistent) {
        easyPersistent = setInterval(chrome.runtime.getPlatformInfo, 26000);
    } else {
        clearInterval(easyPersistent);
    }
}
