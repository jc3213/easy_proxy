let easyDefault = {
    direct: 'autopac',
    indicator: false,
    persistent: false,
    proxies: []
};

let easyStorage = {};
let easyMatch = {};
let easyTempo = {};
let easyRegExp;
let easyScript;

let easyMode;
let easyPersistent;
let easyInspect = {};

let manifest = chrome.runtime.getManifest().manifest_version;
if (manifest === 3) {
    importScripts('libs/matchpattern.js');
}

const messageHandlers = {
    'storage_query': (response) => response({ storage: {...easyDefault, ...easyStorage}, manifest }),
    'storage_update': easyStorageUpdated,
    'pacscript_query': (response, params) => response(easyMatch[params].pac_script),
    'manager_query': (response, params) => response({ storage: easyStorage, tempo: easyTempo, inspect: easyInspect[params.tabId] }),
    'manager_update': easyMatchUpdated,
    'manager_tempo': (response, params) => easyMatchPattern(easyTempo, params),
    'manager_purge': easyTempoPurged,
    'easyproxy_mode': easyModeChanger
};

function easyStorageUpdated(response, json) {
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
            easyMatch[key].clear();
        } else {
            easyMatch[key] = new MatchPattern();
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
    MatchPattern.erase(removed);
    easyStorage = json;
    easyProxyScript();
    persistentModeHandler();
    chrome.storage.local.remove([...invalid, ...removed]);
    chrome.storage.local.set(json);
}

function easyMatchUpdated(response, {add, remove, proxy, tabId}) {
    easyMatchPattern(easyMatch, {add, remove, proxy, tabId});
    easyStorage[proxy] = easyMatch[proxy].data;
    chrome.storage.local.set(easyStorage);
}

function easyMatchPattern(list, {add = [], remove = [], proxy, tabId}) {
    let matchpattern = list[proxy];
    matchpattern.add(...add);
    matchpattern.remove(...remove);
    easyProxyScript();
    chrome.tabs.update(tabId, {url: easyInspect[tabId].url});
}

function easyTempoPurged(response, tabId) {
    easyStorage.proxies.forEach((proxy) => easyTempo[proxy].clear());
    easyProxyScript();
    chrome.tabs.update(tabId, {url: easyInspect[tabId].url});
}

function easyModeChanger(response, params) {
    easyProxyMode(params);
    easyStorage.direct = params;
    chrome.storage.local.set(easyStorage);
    response(true);
}

chrome.runtime.onMessage.addListener((message, sender, response) => {
    messageHandlers[message.action](response, message.params ?? sender);
    return true;
});

const proxyHandlers = {
    'autopac': () => ({ mode: 'pac_script', color: '#2940D9', params: { pacScript: {data: easyScript} } }),
    'direct': () => ({ mode: 'direct', color: '#C1272D' }),
    'global': (direct) => {
        let [scheme, host, port] = direct.split(/[\s:]/);
        let singleProxy = { scheme: scheme.toLowerCase(), host, port: port | 0 };
        return { mode: 'fixed_servers', color: '#208020', params: { rules: { singleProxy, bypassList: ['localhost', '127.0.0.1'] } } };
    }
};

function easyProxyMode(direct) {
    easyMode = direct;
    let handler = proxyHandlers[direct] ?? proxyHandlers.global;
    let {mode, color, params = {}} = handler(direct);
    chrome.proxy.settings.set({ value: { mode, ...params }, scope: 'regular' });
    chrome.action.setBadgeBackgroundColor({color});
}

chrome.action ??= chrome.browserAction;

chrome.tabs.query({}, (tabs) => {
    tabs.forEach(({id, url}) => {
        easyInspect[id] = { host: [], match: [], cache: {}, index: 0, url };
    });
});

chrome.tabs.onCreated.addListener(({id, url}) => {
    easyInspect[id] = { host: [], match: [], cache: {}, index: 0, url };
});

chrome.tabs.onRemoved.addListener((tabId) => {
    delete easyInspect[tabId];
});

chrome.webNavigation.onBeforeNavigate.addListener(({tabId, url, frameId}) => {
    if (frameId === 0) {
        easyInspectSetup(tabId, url);
    }
}, {url: [ {urlPrefix: 'http://'}, {urlPrefix: 'https://'} ]});

chrome.webNavigation.onHistoryStateUpdated.addListener(({tabId, url}) => {
    if (easyInspect[tabId].url !== url) {
        easyInspectSetup(tabId, url);
    }
}, {url: [ {urlPrefix: 'http://'}, {urlPrefix: 'https://'} ]});

function easyInspectSetup(tabId, url) {
    let host = new URL(url).hostname;
    let match = MatchPattern.make(host);
    easyInspect[tabId] = { host: [host], match: [match], cache: { [host]: true, [match]: true }, index: 0, result: [], url };
    easyInspectSync(tabId, host, match);
}

chrome.webRequest.onBeforeRequest.addListener(({tabId, type, url}) => {
    let host = new URL(url).hostname;
    let match = MatchPattern.make(host);
    let inspect = easyInspect[tabId];
    if (!match || !inspect) {
        return;
    }
    if (!inspect.cache[host]) {
        inspect.host.push(host);
        inspect.cache[host] = true;
    }
    if (!inspect.cache[match]) {
        inspect.match.push(match);
        inspect.cache[match] = true;
    }
    if (easyStorage.indicator) {
        easyProxyIndicator(tabId, host, url);
    }
    easyInspectSync(tabId, host, match);
}, {urls: [ 'http://*/*', 'https://*/*' ]});

function easyProxyIndicator(tabId, host, url) {
    if (easyMode === 'direct' || easyMode === 'autopac' && !easyRegExp.test(host)) {
        return;
    }
    easyInspect[tabId].index ++;
    chrome.action.setBadgeText({tabId, text: easyInspect[tabId].index + ''});
}

function easyInspectSync(tabId, host, match) {
    chrome.runtime.sendMessage({action: 'manager_update', params: {tabId, host, match}});
}

chrome.storage.local.get(null, (json) => {
    easyStorage = {...easyDefault, ...json};
    easyStorage.proxies.forEach((proxy) => {
        let match = new MatchPattern();
        let tempo = new MatchPattern();
        match.add(easyStorage[proxy]);
        match.proxy = tempo.proxy = proxy;
        easyMatch[proxy] = match;
        easyTempo[proxy] = tempo;
    });
    easyProxyScript();
    persistentModeHandler();
});

function easyProxyScript() {
    let merge = MatchPattern.merge();
    easyRegExp = merge.regexp;
    easyScript = merge.pac_script;
    easyProxyMode(easyStorage.direct);
}

function persistentModeHandler() {
    if (manifest === 3 && easyStorage.persistent) {
        easyPersistent = setInterval(chrome.runtime.getPlatformInfo, 26000);
    } else {
        clearInterval(easyPersistent);
    }
}
