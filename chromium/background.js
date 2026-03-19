const systemManifest = chrome.runtime.getManifest();
const systemFirefox = systemManifest.browser_specific_settings;
const systemStorage = {
    mode: 'autopac',
    action: 'none',
    handler: [ 'net::ERR_CONNECTION_REFUSED', 'net::ERR_CONNECTION_RESET', 'net::ERR_CONNECTION_TIMED_OUT', 'net::ERR_NAME_NOT_RESOLVED' ],
    network: false,
    preset: null,
    proxies: [],
    exclude: []
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
let easyMatch = new EasyProxy();
let easyTempo = new EasyProxy();
let easySpecial = new EasyProxy();
let easyMode;
let easyInspect = {};

let cacheRules = {};
let cacheRouting = {};
let cacheSpecial = {};

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
            easyMatch.new(key, json[key]);
        } else {
            easyMatch.new(key);
            easyTempo.new(key);
        }
    }
    for (let proxy of easyStorage.proxies) {
        if (!json[proxy]) {
            easyMatch.remove(proxy);
            easyTempo.remove(proxy);
            removed.push(proxy);
        }
    }
    easyStorage = json;
    storageDispatch();
    cacheRouting = {};
    cacheSpecial = {};
    chrome.storage.local.remove([...invalid, ...removed]);
    chrome.storage.local.set(json, response);
}

function managerFetch(response, tabId) {
    let match = easyMatch.routing;
    let tempo = easyTempo.routing;
    let exclude = easySpecial.routing;
    let { proxies, mode, preset } = easyStorage;
    let inspect = easyInspect[tabId];
    if (!inspect) {
        response({ match, tempo, exclude, rules: [], hosts: [], error: [], proxies, mode, preset });
        return;
    }
    let { rules, hosts, error } = inspect;
    response({ match, tempo, exclude, rules: [...rules], hosts: [...hosts], error: [...error], proxies, mode, preset });
}

function proxySubmit(response, { changes, referer }) {
    let updated = new Set();
    for (let { type, proxy, rule, action } of changes) {
        let profile;
        if (type === 'match') {
            updated.add(proxy);
            profile = easyMatch;
        } else {
            profile = type === 'tempo' ? easyTempo : easySpecial;
        }
        if (action === 'add') {
            profile.add(proxy, rule);
        } else {
            profile.delete(proxy, rule);
        }
    }
    for (let u of updated) {
        easyStorage[u] = [...easyMatch.rules.get(u)];
    }
    easyStorage['exclude'] = [...easySpecial.rules.get('DIRECT')];
    cacheRouting = {};
    cacheSpecial = {};
    proxyDispatch();
    chrome.storage.local.set(easyStorage, response);
    updateProxyState(referer);
}

function proxyPurge(response, referer) {
    for (let proxy of easyStorage.proxies) {
        easyTempo[proxy].new();
    }
    cacheRouting = {};
    proxyDispatch();
    updateProxyState(referer);
}

function modeUpdated(response, { mode, referer }) {
    easyMode = easyStorage.mode = mode;
    proxyDispatch();
    chrome.storage.local.set(easyStorage, response);
    updateProxyState(referer);
}

function updateProxyState(url) {
    let host = getHostname(url);
    chrome.tabs.query({ url: '*://' + host + '/*', currentWindow: true }, (tabs) => {
        for (let { id } of tabs) {
            chrome.tabs.reload(id);
        }
    });
}

const messageDispatch = {
    'storage_fetch': (response) => response(easyStorage),
    'storage_update': storageUpdated,
    'profile_fetch': (response, params) => response(easyMatch.getScript(params)),
    'manager_fetch': managerFetch,
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

chrome.tabs.onUpdated.addListener((tabId, { status }) => {
    let inspect = easyInspect[tabId] ??= { rules: new Set(), hosts: new Set(), error: new Set(), index: 0 };
    if (status == 'loading' && inspect.ok) {
        delete easyInspect[tabId];
    } else if (status === 'complete') {
        inspect.ok = true;
    }
});

chrome.tabs.onRemoved.addListener((tabId) => {
    delete easyInspect[tabId];
});

function getHostname(url) {
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
    return host;
}

function inspectRequest(popup, tabId, url) {
    let host = getHostname(url);
    let rule = cacheRules[host] ??= EasyProxy.make(host);
    chrome.runtime.sendMessage({ popup, params: { tabId, rule, host } });
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
    let route = cacheRouting[host] ??= easyMatch.match(host) || easyTempo.match(host);
    if (route) {
        chrome.action.setBadgeText({ tabId, text: `${++inspect.index}` });
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
    let route = cacheRouting[host] ??= easyMatch.match(host) || easyTempo.match(host);
    let exclude = cacheSpecial[host] ??= easySpecial.match(host);
    if (route || exclude) {
        return;
    }
    if (easyAction === 'match') {
        let proxy = easyMatch.rules.get(easyPreset);
        proxy.add(host);
        chrome.storage.local.set({ [easyPreset]: proxy.data });
    } else {
        let proxy = easyTempo.rules.get(easyPreset);
        proxy.add(host);
    }
    proxyDispatch();
    updateProxyState(url);
    chrome.runtime.sendMessage({ popup: 'network_' + easyAction, params: { tabId, host } });
}, { urls: ['http://*/*', 'https://*/*'] });

function storageDispatch() {
    easyNetwork = easyStorage.network;
    easyHandler = new Set(easyStorage.handler);
    easyAction = easyStorage.action;
    easyPreset = easyStorage.preset;
    easyMode = easyStorage.mode;
    easySpecial.new('DIRECT', ['localhost', '127.0.0.1', ...easyStorage.exclude]);
    proxyDispatch();
}

chrome.action ??= chrome.browserAction;
chrome.action.setBadgeBackgroundColor({ color: '#2940D9' });

chrome.storage.local.get(null, async (json) => {
    easyStorage = {...systemStorage, ...json};
    for (let proxy of easyStorage.proxies) {
        easyMatch.new(proxy, easyStorage[proxy]);
        easyTempo.new(proxy);
    }
    storageDispatch();
});
