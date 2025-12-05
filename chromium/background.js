let easyDefault = {
    mode: 'autopac',
    preset: null,
    network: false,
    action: 'none',
    handler: [ 'net::ERR_CONNECTION_REFUSED', 'net::ERR_CONNECTION_RESET', 'net::ERR_CONNECTION_TIMED_OUT', 'net::ERR_NAME_NOT_RESOLVED' ],
    proxies: [],
    exclude: []
};

if (chrome.runtime.getManifest().manifest_version === 3) {
    importScripts('libs/easyproxy.js');
    setInterval(chrome.runtime.getPlatformInfo, 28000);
}

let easyStorage = {};
let easyHandler;
let easyNetwork;
let easyAction;
let easyMatch = {};
let easyTempo = {};
let easyExclude = new EasyProxy();
let easyMode;
let easyInspect = {};

let cacheRules = {};
let cacheCounts = {};
let cacheExclude = {};

function storageUpdated(response, json) {
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
            easyMatch[key] = new EasyProxy(key);
            easyTempo[key] = new EasyProxy(key);
        }
    });
    let removed = easyStorage.proxies.filter((proxy) => {
        if (!json[proxy]) {
            delete easyMatch[proxy];
            delete easyTempo[proxy];
            return true;
        }
    });
    json.preset = json.proxies.length === 0 ? null : json.preset ?? json.proxies[0];
    EasyProxy.delete(removed);
    easyStorage = json;
    storageDispatch();
    cacheCounts = {};
    cacheExclude = {};
    chrome.storage.local.remove([...invalid, ...removed]);
    chrome.storage.local.set(json, response);
}

function proxyQuery(response, tabId) {
    let match = {}
    let tempo = {};
    let { proxies, mode, preset, exclude } = easyStorage;
    let inspect = easyInspect[tabId];
    if (!inspect) {
        response({ match, tempo, exclude, rules: [], hosts: [], error: [], proxies, mode, preset });
        return;
    }
    proxies.forEach((proxy) => {
        match[proxy] = easyMatch[proxy].data;
        tempo[proxy] = easyTempo[proxy].data;
    });
    let { rules, hosts, error } = inspect;
    response({ match, tempo, exclude, rules: [...rules], hosts: [...hosts], error: [...error], proxies, mode, preset });
}

const manageDispatch = {
    'match': (proxy) => easyMatch[proxy],
    'tempo': (proxy) => easyTempo[proxy],
    'exclude': () => easyExclude
};

function proxySubmit(response, { added, removed, tabId }) {
    added.forEach(({ type, proxy, rule }) => {
        let map = manageDispatch[type](proxy);
        map.add(rule);
    });
    removed.forEach(({ type, proxy, rule }) => {
        let map = manageDispatch[type](proxy);
        map.delete(rule);
    });
    easyStorage.proxies.forEach((proxy) => {
        easyStorage[proxy] = easyMatch[proxy].data;
    });
    easyStorage['exclude'] = easyExclude.data;
    modeChanger();
    cacheCounts = {};
    cacheExclude = {};
    chrome.storage.local.set(easyStorage, response);
    chrome.tabs.reload(tabId);
}

function proxyPurge(response, tabId) {
    easyStorage.proxies.forEach((proxy) => easyTempo[proxy].clear());
    modeChanger();
    cacheCounts = {};
    chrome.tabs.reload(tabId);
}

function modeUpdated(response, { proxy, tabId }) {
    easyStorage.mode = proxy;
    modeChanger();
    chrome.storage.local.set(easyStorage, response);
    chrome.tabs.reload(tabId);
}

const messageDispatch = {
    'storage_query': (response) => response(easyStorage),
    'storage_update': storageUpdated,
    'pacscript_query': (response, params) => response(easyMatch[params].pacScript),
    'manager_query': proxyQuery,
    'manager_update': proxySubmit,
    'manager_purge': proxyPurge,
    'easyproxy_mode': modeUpdated
};

chrome.runtime.onMessage.addListener(({ action, params }, sender, response) => {
    messageDispatch[action]?.(response, params);
    return true;
});

const proxyMap = {
    'HTTP': (url) => ({ http: 'http://' + url }),
    'HTTPS': (url) => ({ ssl: 'https://' + url }),
    'SOCKS': (url) => ({ socks: 'socks://' + url, socksVersion: 4 }),
    'SOCKS5': (url) => ({ socks: 'socks://' + url, socksVersion: 5 })
};
const modeFirefox = {
    'autopac': () => ({ proxyType: 'autoConfig', autoConfigUrl: 'data:,' + EasyProxy.pacScript }),
    'direct': () => ({ proxyType: 'none' }),
    'global': () => {
        let proxy = easyStorage.preset ?? easyStorage.proxies[0];
        let [scheme, url] = proxy.split(' ');
        let config = proxyMap[scheme](url);
        config.proxyType = 'manual';
        config.passthrough = 'localhost, 127.0.0.1';
        return config;
    }
};
const modeChromium = {
    'autopac': () => ({ mode: 'pac_script', pacScript: { data: EasyProxy.pacScript } }),
    'direct': () => ({ mode: 'direct' }),
    'global': () => {
        let proxy = easyStorage.preset ?? easyStorage.proxies[0];
        let [scheme, host, port] = proxy.split(/[\s:]/);
        let singleProxy = { scheme: scheme.toLowerCase(), host, port: port | 0 };
        return { mode: 'fixed_servers', rules: { singleProxy, bypassList: ['localhost', '127.0.0.1'] } };
    }
}
const modeMap = typeof browser !== 'undefined' ? modeFirefox : modeChromium;

function modeChanger() {
    let { mode } = easyStorage;
    let value = modeMap[mode]();
    easyMode = mode;
    chrome.proxy.settings.set({ value });
}

chrome.action ??= chrome.browserAction;
chrome.action.setBadgeBackgroundColor({ color: '#2940D9' });

chrome.tabs.onRemoved.addListener((tabId) => {
    delete easyInspect[tabId];
});

chrome.tabs.onUpdated.addListener((tabId, { status }) => {
    let inspect = easyInspect[tabId] ??= { rules: new Set(), hosts: new Set(), error: new Set(), index: 0 }
    if (status == 'loading' && inspect.ok) {
        delete easyInspect[tabId];
    } else if (status === 'complete') {
        inspect.ok = true;
    }
});

function inspectRequest(action, tabId, url) {
    let data = url.split('/')[2];
    let host = data.includes('@') ? data.slice(data.indexOf('@') + 1) : data;
    let rule = cacheRules[host] ??= EasyProxy.make(host);
    chrome.runtime.sendMessage({ action, params: { tabId, rule, host } });
    return { host, rule };
}

function networkCounter(tabId, index, host) {
    if (easyMode === 'direct') {
        return 0;
    }
    let result = cacheCounts[host] ??= EasyProxy.test(host);
    if (result) {
        chrome.action.setBadgeText({ tabId, text: String(++index) });
    }
    return index;
}

chrome.webRequest.onBeforeRequest.addListener(({ tabId, type, url }) => {
    if (tabId === -1) {
        return;
    }
    let inspect = easyInspect[tabId] ??= { rules: new Set(), hosts: new Set(), error: new Set(), index: 0 };
    let { host, rule } = inspectRequest('network_update', tabId, url);
    inspect.rules.add(rule);
    inspect.hosts.add(host);
    if (easyNetwork) {
        inspect.index = networkCounter(tabId, inspect.index, host);
    }
}, { urls: ['http://*/*', 'https://*/*'] });

function actionHandler(action, proxy, tabId, host) {
    let result = cacheRules[host] ??= !easyExclude.test(host);
    if (result) {
        proxy.add(host);
        modeChanger();
        chrome.runtime.sendMessage({ action, params: { tabId, host } });
    }
}

const actionMap = {
    'none': (tabId, preset, host, rule) => {
        let { error } = easyInspect[tabId];
        error.add(rule);
        error.add(host);
    },
    'match': (tabId, preset, host) => actionHandler('network_match', easyMatch[preset], tabId, host),
    'tempo': (tabId, preset, host) => actionHandler('network_tempo', easyTempo[preset], tabId, host)
};

chrome.webRequest.onErrorOccurred.addListener(({ tabId, error, url }) => {
    if (!easyHandler.has(error)) {
        return;
    }
    let { preset } = easyStorage;
    if (!preset) {
        return;
    }
    let { host, rule } = inspectRequest('network_error', tabId, url);
    actionMap[easyAction]?.(tabId, preset, host, rule);
}, { urls: ['http://*/*', 'https://*/*'] });

function storageDispatch() {
    easyNetwork = easyStorage.network;
    easyHandler = new Set(easyStorage.handler);
    easyAction = easyStorage.action;
    easyExclude.new(easyStorage.exclude);
    modeChanger();
}

chrome.storage.local.get(null, async (json) => {
    easyStorage = {...easyDefault, ...json};
    easyStorage.proxies.forEach((proxy) => {
        easyMatch[proxy] = new EasyProxy(proxy);
        easyTempo[proxy] = new EasyProxy(proxy);
        easyMatch[proxy].new(easyStorage[proxy]);
    });
    storageDispatch();
});
