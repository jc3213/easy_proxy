const systemManifest = chrome.runtime.getManifest();
const systemFirefox = systemManifest.browser_specific_settings;
const systemURLs = ['http://*/*', 'https://*/*'];
const systemStorage = {
    mode: 'autopac',
    action: 'none',
    handler: [ 'net::ERR_CONNECTION_REFUSED', 'net::ERR_CONNECTION_RESET', 'net::ERR_CONNECTION_TIMED_OUT', 'net::ERR_NAME_NOT_RESOLVED' ],
    network: false,
    preset: null,
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
let easyMatch = new EasyProxy();
let easyTempo = new EasyProxy();
let easyExclude = new EasyProxy();
let easyMode;
let easyTab;
let easyPopup;
let easyInspect = {};

let cacheRules = {};
let cacheRouting = {};
let cacheExclude = {};

function optionsStorage(response, json) {
    let removed = []
    for (let key of Object.keys(json)) {
        if (key in systemStorage) {
            continue;
        }
        if (json.proxies.includes(key)) {
            easyMatch.new(key, json[key]);
            continue;
        }
        removed.push(key);
        delete json[key];
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
    cacheExclude = {};
    chrome.storage.local.remove(removed);
    chrome.storage.local.set(json, response);
}

function popupSubmit(response, { changes, referer }) {
    let updated = new Set();
    for (let { type, proxy, rule, action } of changes) {
        let profile;
        if (type === 'match') {
            updated.add(proxy);
            profile = easyMatch;
        } else {
            profile = type === 'tempo' ? easyTempo : easyExclude;
        }
        if (action === 'add') {
            profile.add(proxy, rule);
        } else {
            profile.delete(proxy, rule);
        }
    }
    for (let u of updated) {
        easyStorage[u] = easyMatch.getRules(u);
    }
    easyStorage['exclude'] = easyExclude.getRules('DIRECT');
    chrome.storage.local.set(easyStorage, response);
    cacheRouting = {};
    cacheExclude = {};
    proxyDispatch();
    updateProxyState(referer);
}

function proxyPurge(response, referer) {
    cacheRouting = {};
    easyTempo.purge();
    proxyDispatch();
    updateProxyState(referer);
}

function proxyMode(response, { mode, referer }) {
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

const messageDispatch = {
    'options_runtime': (response) => response(easyStorage),
    'options_storage': optionsStorage,
    'options_script': (response, params) => response(easyMatch.getScript(params)),
    'popup_submit': popupSubmit,
    'popup_purge': proxyPurge,
    'popup_mode': proxyMode
};

chrome.runtime.onMessage.addListener(({ action, params }, sender, response) => {
    messageDispatch[action]?.(response, params);
    return true;
});

chrome.runtime.onConnect.addListener(port => {
    if (port.name !== 'popup') {
        return;
    }
    easyPopup = port;
    port.onMessage.addListener((tabId) => {
        easyTab = tabId;
        let { proxies, mode, preset } = easyStorage;
        let params = {
            match: easyMatch.routing,
            tempo: easyTempo.routing,
            exclude: easyExclude.routing,
            rules: [],
            hosts: [],
            error: [],
            proxies,
            mode,
            preset
        };
        let inspect = easyInspect[tabId];
        if (inspect) {
            params.rules = [...inspect.rules];
            params.hosts = [...inspect.hosts];
            params.error = [...inspect.error];
        }
        port.postMessage({ action: 'proxy_init', params });
    });
    port.onDisconnect.addListener(() => {
        easyPopup = easyTab = null;
    });
});

chrome.webNavigation.onBeforeNavigate.addListener(({ tabId, frameId, url }) => {
    if (frameId === 0) {
        easyInspect[tabId] = { rules: new Set(), hosts: new Set(), error: new Set(), index: 0, url };
    }
});

chrome.tabs.onUpdated.addListener((tabId, { url }) => {
    if (url && url !== easyInspect[tabId]?.url) {
        easyInspect[tabId] = { rules: new Set(), hosts: new Set(), error: new Set(), index: 0, url };
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

chrome.webRequest.onBeforeRequest.addListener(({ tabId, type, url }) => {
    if (tabId === -1) {
        return;
    }
    let { hosts, rules, index } = easyInspect[tabId] ??= { rules: new Set(), hosts: new Set(), error: new Set(), index: 0, url };
    let host = getHostname(url);
    let rule = cacheRules[host] ??= EasyProxy.make(host);
    if (!hosts.has(host)) {
        hosts.add(host);
        rules.add(rule);
        if (tabId === easyTab) {
            easyPopup.postMessage({ action: 'proxy_sync', params: { host, rule } });
        }
    }
    if (!easyNetwork || easyMode === 'direct') {
        return;
    }
    let routing = cacheRouting[host] ??= easyMatch.match(host) || easyTempo.match(host);
    if (routing) {
        easyInspect[tabId].index = ++index;
        chrome.action.setBadgeText({ tabId, text: `${index}` });
    }
}, { urls: systemURLs });

chrome.webRequest.onErrorOccurred.addListener(({ tabId, error, url }) => {
    if (!easyHandler.has(error) || !easyPreset) {
        return;
    }
    let host = getHostname(url);
    if (easyAction === 'none') {
        let rule = cacheRules[host] ??= EasyProxy.make(host);
        let { error } = easyInspect[tabId];
        error.add(host);
        error.add(rule);
        easyPopup?.postMessage({ action: 'proxy_error', params: { host, rule } });
        return;
    }
    let routing = cacheRouting[host] ??= easyMatch.match(host) || easyTempo.match(host);
    let exclude = cacheExclude[host] ??= easyExclude.match(host);
    if (routing || exclude) {
        return;
    }
    if (easyAction === 'match') {
        easyMatch.add(easyPreset, host);
        chrome.storage.local.set({ [easyPreset]: easyMatch.getRules(easyPreset) });
    } else {
        easyTempo.add(easyPreset, host);
    }
    easyPopup?.postMessage({ action: 'proxy_' + easyAction, params: host });
    proxyDispatch();
    updateProxyState(url);
}, { urls: systemURLs });

function storageDispatch() {
    easyNetwork = easyStorage.network;
    easyHandler = new Set(easyStorage.handler);
    easyAction = easyStorage.action;
    easyPreset = easyStorage.preset;
    easyMode = easyStorage.mode;
    easyExclude.new('DIRECT', ['localhost', '127.0.0.1', ...easyStorage.exclude]);
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
