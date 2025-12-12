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
let easyPreset;
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
    let removed = []
    for (let key of Object.keys(json)) {
        if (key in easyDefault) {
            continue;
        }
        if (!json.proxies.includes(key)) {
            delete json[key];
            invalid.push(key);
            continue;
        }
        if (easyStorage.proxies.includes(key)) {
            easyMatch[key].new(json[key]);
        } else {
            easyMatch[key] = new EasyProxy(key);
            easyTempo[key] = new EasyProxy(key);
        }
    }
    for (let proxy of easyStorage.proxies) {
        if (!json[proxy]) {
            delete easyMatch[proxy];
            delete easyTempo[proxy];
            removed.push(proxy);
        }
    }
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
    for (let proxy of proxies) {
        match[proxy] = easyMatch[proxy].data;
        tempo[proxy] = easyTempo[proxy].data;
    }
    let { rules, hosts, error } = inspect;
    response({ match, tempo, exclude, rules: [...rules], hosts: [...hosts], error: [...error], proxies, mode, preset });
}

function proxySubmit(response, { changes, tabId }) {
    for (let { type, proxy, rule, action } of changes) {
        let rules = type === 'match' ? easyMatch[proxy] : type === 'tempo' ? easyTempo[proxy] : easyExclude;
        action === 'add' ? rules.add(rule) : rules.delete(rule);
    }
    for (let proxy of easyStorage.proxies) {
        easyStorage[proxy] = easyMatch[proxy].data;
    }
    easyStorage['exclude'] = easyExclude.data;
    proxySwitch();
    cacheCounts = {};
    cacheExclude = {};
    chrome.storage.local.set(easyStorage, response);
    chrome.tabs.reload(tabId);
}

function proxyPurge(response, tabId) {
    for (let proxy of easyStorage.proxies) {
        easyTempo[proxy].new();
    }
    proxySwitch();
    cacheCounts = {};
    chrome.tabs.reload(tabId);
}

function modeUpdated(response, { proxy, tabId }) {
    easyStorage.mode = proxy;
    proxySwitch();
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

function proxyFirefox(mode) {
    if (mode === 'autopac') {
        return { proxyType: 'autoConfig', autoConfigUrl: 'data:,' + EasyProxy.pacScript };
    }
    if (mode === 'direct') {
        return { proxyType: 'none' };
    }
    let proxy = easyPreset ?? easyStorage.proxies[0];
    let config = { proxyType: 'manual', passthrough: 'localhost, 127.0.0.1' };
    let [scheme, url] = proxy.split(' ');
    if (scheme === 'HTTP') {
        config.http = 'http://' + url;
    } else if (scheme === 'HTTPS') {
        config.ssl = 'https://' + url;
    } else {
        config.socks = 'socks://' + url;
        config.socksVersion = scheme === 'SOCKS' ? 4 : 5;
    }
    return config;
}
function proxyChromium(mode) {
    if (mode === 'autopac') {
        return { mode: 'pac_script', pacScript: { data: EasyProxy.pacScript } };
    }
    if (mode === 'direct') {
        return { mode: 'direct' };
    }
    let proxy = easyPreset ?? easyStorage.proxies[0];
    let [scheme, host, port] = proxy.split(/[\s:]/);
    let singleProxy = { scheme: scheme.toLowerCase(), host, port: port | 0 };
    return { mode: 'fixed_servers', rules: { singleProxy, bypassList: ['localhost', '127.0.0.1'] } };
}
const proxyMode = typeof browser !== 'undefined' ? proxyFirefox : proxyChromium;

function proxySwitch() {
    let { mode } = easyStorage;
    let value = proxyMode(mode);
    chrome.proxy.settings.set({ value });
    easyMode = mode;
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

chrome.webRequest.onBeforeRequest.addListener(({ tabId, type, url }) => {
    if (tabId === -1) {
        return;
    }
    let inspect = easyInspect[tabId] ??= { rules: new Set(), hosts: new Set(), error: new Set(), index: 0 };
    let { host, rule } = inspectRequest('network_update', tabId, url);
    inspect.rules.add(rule);
    inspect.hosts.add(host);
    if (!easyNetwork || easyMode === 'direct') {
        return;
    }
    let match = cacheCounts[host] ??= EasyProxy.test(host);
    if (match) {
        chrome.action.setBadgeText({ tabId, text: String(++inspect.index) });
    }
}, { urls: ['http://*/*', 'https://*/*'] });

function actionHandler(action, proxy, tabId, host) {
    if (!proxy) {
        return;
    }
    let match = cacheRules[host] ??= !easyExclude.test(host);
    if (match) {
        proxy.add(host);
        proxySwitch();
        chrome.runtime.sendMessage({ action, params: { tabId, host } });
    }
}

const actionMap = {
    'none': (tabId, host, rule) => {
        let { error } = easyInspect[tabId];
        error.add(rule);
        error.add(host);
    },
    'match': (tabId, host) => actionHandler('network_match', easyMatch[easyPreset], tabId, host),
    'tempo': (tabId, host) => actionHandler('network_tempo', easyTempo[easyPreset], tabId, host)
};

chrome.webRequest.onErrorOccurred.addListener(({ tabId, error, url }) => {
    if (!easyHandler.has(error)) {
        return;
    }
    if (!easyPreset) {
        return;
    }
    let { host, rule } = inspectRequest('network_error', tabId, url);
    actionMap[easyAction]?.(tabId, host, rule);
}, { urls: ['http://*/*', 'https://*/*'] });

function storageDispatch() {
    easyNetwork = easyStorage.network;
    easyHandler = new Set(easyStorage.handler);
    easyAction = easyStorage.action;
    easyPreset = easyStorage.preset;
    easyExclude.new(easyStorage.exclude);
    proxySwitch();
}

chrome.storage.local.get(null, async (json) => {
    easyStorage = {...easyDefault, ...json};
    for (let proxy of easyStorage.proxies) {
        easyMatch[proxy] = new EasyProxy(proxy);
        easyTempo[proxy] = new EasyProxy(proxy);
        easyMatch[proxy].new(easyStorage[proxy]);
    }
    storageDispatch();
});
