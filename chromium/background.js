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
let easyMode;
let easyScript;
let easyPersistent;
let easyInspect = {};

let manifest = chrome.runtime.getManifest().manifest_version;
let system = typeof browser !== 'undefined' ? 'firefox' : 'chromium';
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
    'autopac': {
        color: '#2940D9',
        chromium: () => ({ mode: 'pac_script', pacScript: { data: easyScript } }),
        firefox: () => ({ proxyType: "autoConfig", autoConfigUrl: 'data:,' + easyScript })
    },
    'direct': {
        color: '#C1272D',
        chromium: () => ({ mode: 'direct' }),
        firefox: () => ({ proxyType: "none" })
    },
    'global': {
        color: '#208020', 
        chromium: (direct) => {
            let [scheme, host, port] = direct.split(/[\s:]/);
            let singleProxy = { scheme: scheme.toLowerCase(), host, port: port | 0 };
            return ({ mode: 'fixed_servers', rules: { singleProxy, bypassList: ['localhost', '127.0.0.1'] } });
        },
        firefox: (direct) => {
            let [scheme, proxy] = direct.split(' ');
            let config = proxyHandlers[scheme](proxy);
            return ({ proxyType: "manual", passthrough: "localhost, 127.0.0.1", ...config });
        }
    },
    'SOCKS': (proxy) => ({ socks: 'socks://' + proxy, socksVersion: 4 }),
    'SOCKS5': (proxy) => ({ socks: 'socks://' + proxy, socksVersion: 5 }),
    'HTTPS': (proxy) => ({ ssl: 'https://' + proxy }),
    'HTTP': (proxy) => ({ http: 'http://' + proxy })
};

function easyProxyMode(direct) {
    easyMode = direct;
    let {color, [system]: config} = proxyHandlers[direct] ?? proxyHandlers.global;
    let value = config(direct);
    chrome.proxy.settings.set({ value });
    chrome.action.setBadgeBackgroundColor({ color });
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
    let match = MatchPattern.make(url);
    easyInspect[tabId] = { result: [match], cache: {}, index: 0, url };
    easyInspectSync(tabId, match);
}

chrome.webRequest.onBeforeRequest.addListener(({tabId, type, url}) => {
    let inspect = easyInspect[tabId];
    let match = MatchPattern.make(url);
    if (!inspect?.result || !match) {
        return;
    }
    if (!inspect.cache[match]) {
        inspect.result.push(match);
        inspect.cache[match] = true;
    }
    if (easyStorage.indicator) {
        easyProxyIndicator(tabId, url);
    }
    easyInspectSync(tabId, match);
}, {urls: [ 'http://*/*', 'https://*/*' ]});

function easyProxyIndicator(tabId, url) {
    if (proxyHandlers[easyMode] && !easyRegExp.test(new URL(url).hostname)) {
        return;
    }
    easyInspect[tabId].index ++;
    chrome.action.setBadgeText({tabId, text: easyInspect[tabId].index + ''});
}

function easyInspectSync(tabId, result) {
    chrome.runtime.sendMessage({action: 'manager_update', params: {tabId, result}});
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
    easyScript = merge.pac_script;
    easyRegExp = merge.regexp;
    easyProxyMode(easyStorage.direct);
}

function persistentModeHandler() {
    if (manifest === 3 && easyStorage.persistent) {
        easyPersistent = setInterval(chrome.runtime.getPlatformInfo, 26000);
    } else {
        clearInterval(easyPersistent);
    }
}
