const systemManifest = chrome.runtime.getManifest();
const systemFirefox = systemManifest.browser_specific_settings;
const systemStorage = {
    mode: 'autopac',
    preset: null,
    network: false,
    action: 'none',
    handler: [ 'net::ERR_CONNECTION_REFUSED', 'net::ERR_CONNECTION_RESET', 'net::ERR_CONNECTION_TIMED_OUT', 'net::ERR_NAME_NOT_RESOLVED' ],
    proxies: [],
    exclude: ['localhost', '127.0.0.1']
};

if (systemManifest.manifest_version === 3) {
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
let easyExclude = new EasyProxy('DIRECT');
let easyMode;
let easyInspect = {};

let cacheRules = {};
let cacheRoute = {};
let cacheExclude = {};

function storageUpdated(response, json) {
    let invalid = [];
    let removed = []
    for (let key of Object.keys(json)) {
        if (key in systemStorage) {
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
            easyMatch[proxy].destroy();
            easyTempo[proxy].destroy();
            delete easyMatch[proxy];
            delete easyTempo[proxy];
            removed.push(proxy);
        }
    }
    easyStorage = json;
    storageDispatch();
    cacheRoute = {};
    cacheExclude = {};
    chrome.storage.local.remove([...invalid, ...removed]);
    chrome.storage.local.set(json, response);
}

function proxyQuery(response, tabId) {
    let match = {};
    let tempo = {};
    let exclude = easyExclude.route;
    let { proxies, mode, preset } = easyStorage;
    let inspect = easyInspect[tabId];
    if (!inspect) {
        response({ match, tempo, exclude, rules: [], hosts: [], error: [], proxies, mode, preset });
        return;
    }
    for (let proxy of proxies) {
        match = { ...match, ...easyMatch[proxy].route };
        tempo = { ...tempo, ...easyTempo[proxy].route };
    }
    let { rules, hosts, error } = inspect;
    response({ match, tempo, exclude, rules: [...rules], hosts: [...hosts], error: [...error], proxies, mode, preset });
}

function proxySubmit(response, { changes, tabId }) {
    for (let { type, proxy, rule, action } of changes) {
        let profile = type === 'match' ? easyMatch[proxy] : type === 'tempo' ? easyTempo[proxy] : easyExclude;
        action === 'add' ? profile.add(rule) : profile.delete(rule);
    }
    for (let proxy of easyStorage.proxies) {
        easyStorage[proxy] = easyMatch[proxy].data;
    }
    easyStorage['exclude'] = easyExclude.data;
    cacheRoute = {};
    cacheExclude = {};
    proxyDispatch();
    chrome.storage.local.set(easyStorage, response);
    chrome.tabs.reload(tabId);
}

function proxyPurge(response, tabId) {
    for (let proxy of easyStorage.proxies) {
        easyTempo[proxy].new();
    }
    cacheRoute = {};
    proxyDispatch();
    chrome.tabs.reload(tabId);
}

function modeUpdated(response, { tabId, mode }) {
    easyMode = easyStorage.mode = mode;
    proxyDispatch();
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

function proxyDispatch() {
    let value;
    if (easyMode === 'autopac') {
        value = systemFirefox
            ? { proxyType: 'autoConfig', autoConfigUrl: 'data:,' + EasyProxy.pacScript }
            : { mode: 'pac_script', pacScript: { data: EasyProxy.pacScript } };
    } else if (easyMode === 'direct') {
        value = systemFirefox
            ? { proxyType: 'none' }
            : { mode: 'direct' };
    } else {
        if (systemFirefox) {
            let proxy = easyPreset ?? easyStorage.proxies[0];
            let [scheme, url] = proxy.split(' ');
            value = { proxyType: 'manual', passthrough: 'localhost, 127.0.0.1' };
            if (scheme === 'HTTP') {
                value.http = 'http://' + url;
            } else if (scheme === 'HTTPS') {
                value.ssl = 'https://' + url;
            } else {
                value.socks = 'socks://' + url;
                value.socksVersion = scheme === 'SOCKS' ? 4 : 5;
            }
        } else {
            let proxy = easyPreset ?? easyStorage.proxies[0];
            let [scheme, host, port] = proxy.split(/[\s:]/);
            let singleProxy = { scheme: scheme.toLowerCase(), host, port: port | 0 };
            value = { mode: 'fixed_servers', rules: { singleProxy, bypassList: ['localhost', '127.0.0.1'] } };
        }
    }
    chrome.proxy.settings.set({ value });
}

chrome.action ??= chrome.browserAction;
chrome.action.setBadgeBackgroundColor({ color: '#2940D9' });

chrome.tabs.onRemoved.addListener((tabId) => {
    delete easyInspect[tabId];
});

chrome.tabs.onUpdated.addListener((tabId, { status }) => {
    let inspect = easyInspect[tabId] ??= { rules: new Set(), hosts: new Set(), error: new Set(), index: 0 };
    if (status == 'loading' && inspect.ok) {
        delete easyInspect[tabId];
    } else if (status === 'complete') {
        inspect.ok = true;
    }
});

function inspectRequest(action, tabId, url) {
    let start = url.indexOf('//') + 2;
    let end = url.indexOf('/', start);
    let host = url.substring(start, end);
    let at = host.indexOf('@');
    if (at !== -1) {
        host = host.substring(at + 1);
    }
    let colon = host.indexOf(':');
    if (colon !== -1) {
        host = host.substring(0, colon);
    }
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
    let match = cacheRoute[host] ??= EasyProxy.match(host);
    if (match) {
        chrome.action.setBadgeText({ tabId, text: String(++inspect.index) });
    }
}, { urls: ['http://*/*', 'https://*/*'] });

chrome.webRequest.onErrorOccurred.addListener(({ tabId, error, url }) => {
    if (!easyHandler.has(error) || !easyPreset) {
        return;
    }
    let { host, rule } = inspectRequest('network_error', tabId, url);
    if (easyAction === 'none') {
        let { error } = easyInspect[tabId];
        error.add(rule);
        error.add(host);
        return;
    }
    let exclude = cacheExclude[host] ??= easyExclude.match(host);
    if (exclude) {
        return;
    }
    if (easyAction === 'match') {
        let proxy = easyMatch[easyPreset];
        proxy.add(host);
        chrome.storage.local.set({ [easyPreset]: proxy.data });
    } else {
        let proxy = easyTempo[easyPreset];
        proxy.add(host);
    }
    proxyDispatch();
    chrome.runtime.sendMessage({ action: 'network_' + easyAction, params: { tabId, host } });
}, { urls: ['http://*/*', 'https://*/*'] });

function storageDispatch() {
    easyNetwork = easyStorage.network;
    easyHandler = new Set(easyStorage.handler);
    easyAction = easyStorage.action;
    easyPreset = easyStorage.preset;
    easyMode = easyStorage.mode;
    easyExclude.new(easyStorage.exclude);
    proxyDispatch();
}

chrome.storage.local.get(null, async (json) => {
    easyStorage = {...systemStorage, ...json};
    for (let proxy of easyStorage.proxies) {
        easyMatch[proxy] = new EasyProxy(proxy);
        easyTempo[proxy] = new EasyProxy(proxy);
        easyMatch[proxy].new(easyStorage[proxy]);
    }
    storageDispatch();
});
