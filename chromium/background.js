let easyDefault = {
    direct: 'autopac',
    indicator: false,
    persistent: false,
    proxies: []
};
let easyColor = {
    direct: '#2940D9',
    autopac: '#C1272D',
    global: '#208020'
};

let easyStorage = {};
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
    easyProxyScript();
    persistentModeHandler();
    chrome.storage.local.remove([...invalid, ...removed]);
    chrome.storage.local.set(json);
}

function easyManageQuery(tabId, response) {
    let match = {}
    let tempo = {};
    let rule = [];
    let host = [];
    let {proxies, direct} = easyStorage;
    let inspect = easyInspect[tabId];
    if (inspect) {
        rule = [...inspect.rule];
        host = [...inspect.host];
    }
    proxies.forEach((proxy) => {
        match[proxy] = easyMatch[proxy].data;
        tempo[proxy] = easyTempo[proxy].data;
    });
    response({ match, tempo, rule, host, proxies, direct });
}

function easyManageUpdated({add, remove, proxy, tabId}) {
    easyMatchPattern(easyMatch, {add, remove, proxy, tabId});
    easyStorage[proxy] = easyMatch[proxy].data;
    chrome.storage.local.set(easyStorage);
}

function easyMatchPattern(list, {add = [], remove = [], proxy, tabId}) {
    let matchpattern = list[proxy];
    matchpattern.add(add);
    matchpattern.remove(remove);
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
            easyManageQuery(params, response);
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

function firefoxHandler(scheme, proxy) {
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

function easyProxyMode(direct, value) {
    easyMode = direct;
    let color = easyColor[direct] ?? easyColor.global;
    if (firefox) {
        switch (direct) {
            case 'autopac':
                value = { proxyType: "autoConfig", autoConfigUrl: 'data:,' + easyScript };
                break;
            case 'direct':
                value = { proxyType: "none" };
                break;
            default:
                let [scheme, proxy] = direct.split(' ');
                let config = firefoxHandler(scheme, proxy);
                value = { proxyType: "manual", passthrough: "localhost, 127.0.0.1", ...config };
                break;
        };
    } else {
        switch (direct) {
            case 'autopac':
                value = { mode: 'pac_script', pacScript: { data: easyScript } };
                break;
            case 'direct':
                value = { mode: 'direct' };
                break;
            default:
                let [scheme, host, port] = direct.split(/[\s:]/);
                let singleProxy = { scheme: scheme.toLowerCase(), host, port: port | 0 };
                value = { mode: 'fixed_servers', rules: { singleProxy, bypassList: ['localhost', '127.0.0.1'] } };
                break;
        };
    }
    chrome.proxy.settings.set({ value });
    chrome.action.setBadgeBackgroundColor({ color });
}

chrome.action ??= chrome.browserAction;

chrome.tabs.onRemoved.addListener((tabId) => {
    delete easyInspect[tabId];
});

chrome.tabs.onUpdated.addListener(async (tabId, {status}, {url}) => {
    switch (status) {
        case 'loading':
            if (url.startsWith('http') && !easyTabs.has(tabId)) {
                easyTabs.add(tabId);
                let {host, rule} = await MatchPattern.make(url);
                easyInspect[tabId] = { rule: new Set([rule]), host: new Set([host]), index: 0, url };
                easyInspectSync(tabId, host, rule);
            }
            break;
        case 'complete':
            easyTabs.delete(tabId);
            break;
    };
});

chrome.webRequest.onBeforeRequest.addListener(async ({tabId, type, url}) => {
    let inspect = easyInspect[tabId] ??= { rule: new Set(), host: new Set(), index: 0 };
    let {host, rule} = await MatchPattern.make(url);
    inspect.rule.add(rule);
    inspect.host.add(host);
    if (easyStorage.indicator) {
        inspect.index = easyProxyIndicator(tabId, inspect.index, url);
    }
    easyInspectSync(tabId, host, rule);
}, {urls: [ 'http://*/*', 'https://*/*' ]});

function easyProxyIndicator(tabId, index, url) {
    if (proxyHandlers[easyMode] && !easyRegExp.test(new URL(url).hostname)) {
        return;
    }
    chrome.action.setBadgeText({tabId, text: ++index + ''});
    return index;
}

function easyInspectSync(tabId, host, rule) {
    chrome.runtime.sendMessage({action: 'manager_update', params: { tabId, rule, host }});
}

chrome.storage.local.get(null, (json) => {
    easyStorage = {...easyDefault, ...json};
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
