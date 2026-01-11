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
    let match = [];
    let tempo = [];
    let exclude = [];
    let { proxies, mode, preset } = easyStorage;
    let inspect = easyInspect[tabId];
    if (!inspect) {
        response({ match, tempo, exclude, rules: [], hosts: [], error: [], proxies, mode, preset });
        return;
    }
    for (let e of easyExclude.data) {
        exclude.push([e, 'DIRECT']);
    }
    for (let proxy of proxies) {
        for (let m of easyMatch[proxy].data) {
            match.push([m, proxy]);
        }
        for (let t of easyTempo[proxy].data) {
            tempo.push([t, proxy]);
        }
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
    cacheCounts = {};
    cacheExclude = {};
    proxyUpdated();
    chrome.storage.local.set(easyStorage, response);
    chrome.tabs.update(tabId, { url: easyInspect[tabId].url });
}

function proxyPurge(response, tabId) {
    for (let proxy of easyStorage.proxies) {
        easyTempo[proxy].new();
    }
    cacheCounts = {};
    proxyUpdated();
    chrome.tabs.update(tabId, { url: easyInspect[tabId].url });
}

function modeUpdated(response, { tabId, mode }) {
    easyMode = easyStorage.mode = mode;
    proxyUpdated();
    chrome.storage.local.set(easyStorage, response);
    chrome.tabs.update(tabId, { url: easyInspect[tabId].url });
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

function proxyFirefox() {
    if (easyMode === 'autopac') {
        return { proxyType: 'autoConfig', autoConfigUrl: 'data:,' + EasyProxy.pacScript };
    }
    if (easyMode === 'direct') {
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
function proxyChromium() {
    if (easyMode === 'autopac') {
        return { mode: 'pac_script', pacScript: { data: EasyProxy.pacScript } };
    }
    if (easyMode === 'direct') {
        return { mode: 'direct' };
    }
    let proxy = easyPreset ?? easyStorage.proxies[0];
    let [scheme, host, port] = proxy.split(/[\s:]/);
    let singleProxy = { scheme: scheme.toLowerCase(), host, port: port | 0 };
    return { mode: 'fixed_servers', rules: { singleProxy, bypassList: ['localhost', '127.0.0.1'] } };
}
const proxyDispatch = typeof browser !== 'undefined' ? proxyFirefox : proxyChromium;

function proxyUpdated() {
    let value = proxyDispatch();
    chrome.proxy.settings.set({ value });
}

chrome.action ??= chrome.browserAction;
chrome.action.setBadgeBackgroundColor({ color: '#2940D9' });

chrome.tabs.onRemoved.addListener((tabId) => {
    delete easyInspect[tabId];
});

chrome.tabs.onUpdated.addListener((tabId, { status }, { url }) => {
    let inspect = easyInspect[tabId] ??= { rules: new Set(), hosts: new Set(), error: new Set(), index: 0 };
    if (status == 'loading') {
        if (inspect.ok) {
            easyInspect[tabId] = { rules: new Set(), hosts: new Set(), error: new Set(), index: 0, url };
        } else {
            inspect.url = url;
        }
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

function actionHandler(tabId, host, action, rules) {
    let proxy = rules[easyPreset];
    if (!proxy) {
        return;
    }
    let match = cacheExclude[host] ??= !easyExclude.test(host);
    if (match) {
        proxy.add(host);
        proxyUpdated();
        chrome.runtime.sendMessage({ action, params: { tabId, host } });
    }
}

const actionMap = {
    'none': (tabId, host, rule) => {
        let { error } = easyInspect[tabId];
        error.add(rule);
        error.add(host);
    },
    'match': (tabId, host) => actionHandler(tabId, host, 'network_match', easyMatch),
    'tempo': (tabId, host) => actionHandler(tabId, host, 'network_tempo', easyTempo)
};

chrome.webRequest.onErrorOccurred.addListener(({ tabId, error, url }) => {
    if (!easyHandler.has(error) || !easyPreset) {
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
    easyMode = easyStorage.mode;
    easyExclude.new(easyStorage.exclude);
    proxyUpdated();
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
