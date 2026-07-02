const systemManifest = chrome.runtime.getManifest();
const systemFirefox = Boolean(systemManifest.browser_specific_settings);
const systemURLs = ['http://*/*', 'https://*/*'];
const systemStorage = {
    mode: 'autopac',
    action: 'none',
    handler: [ 'net::ERR_CONNECTION_REFUSED', 'net::ERR_CONNECTION_RESET', 'net::ERR_CONNECTION_TIMED_OUT', 'net::ERR_NAME_NOT_RESOLVED' ],
    network: false,
    reload: 'none',
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
let easyReload;
let easyMatch = new EasyProxy();
let easyTempo = new EasyProxy();
let easyExclude = new EasyProxy();
let easyMode;
let easyInspect = {};
let easyDelayed;

let cacheRules = {};
let cacheRouting = {};
let cacheExclude = {};

chrome.runtime.onMessage.addListener((message, sender, response) => {
    let action = message.action;
    let params = message.params;

    if (action === 'options_runtime') {
        response(easyStorage);
        return;
    }

    if (action === 'options_storage') {
        storageUpdated(response, params);
        return true;
    }

    if (action === 'options_script') {
        let pacScript = easyMatch.getScript(params);
        response(pacScript);
        return;
    }
});

function storageUpdated(response, json) {
    let removed = []
    let new_keys = Object.keys(json);

    for (let i = 0, l = new_keys.length; i < l; i++) {
        let key = new_keys[i];

        if (key in systemStorage) {
            continue;
        }

        if (json.proxies.includes(key)) {
            easyMatch.addProxy(key, json[key]);
            continue;
        }

        removed.push(key);
        delete json[key];
    }

    let old_proxies = easyStorage.proxies;

    for (let i = 0, l = old_proxies.length; i < l; i++) {
        let proxy = old_proxies[i];

        if (!json[proxy]) {
            easyMatch.removeProxy(proxy);
            easyTempo.removeProxy(proxy);
            removed.push(proxy);
        }
    }

    storageDispatch(json);
    cacheRouting = {};
    cacheExclude = {};
    chrome.storage.local.remove(removed);
    chrome.storage.local.set(json, response);
}

function proxyDispatch() {
    let value;

    if (easyMode === 'autopac') {
        if (systemFirefox) {
            value = { proxyType: 'autoConfig', autoConfigUrl: 'data:,' + EasyProxy.pacScript };
        } else {
            value = { mode: 'pac_script', pacScript: { data: EasyProxy.pacScript } };
        }
    } else if (easyMode === 'direct') {
        if (systemFirefox) {
            value = { proxyType: 'none' };
        } else {
            value = { mode: 'direct' };
        }
    } else {
        let proxy = easyPreset || easyStorage.proxies[0];
        let entries = proxy.split(' ');

        if (systemFirefox) {
            let scheme = entries[0];
            let url = entries[1];
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
            let singleProxy = { scheme: entries[0].toLowerCase(), host: entries[1], port: entries[2] | 0 };
            value = { mode: 'fixed_servers', rules: { singleProxy, bypassList: ['localhost', '127.0.0.1'] } };
        }
    }

    chrome.proxy.settings.set({ value });
}

let popupTab;
let popupPort;

chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== 'popup') {
        return;
    }

    popupPort = port;

    port.onMessage.addListener((message) => {
        let action = message.action;
        let params = message.params;

        if (action === 'popup_runtime') {
            popupRuntime(params);
            return;
        }

        if (action === 'popup_submit') {
            popupSubmit(params);
            return;
        }

        if (action === 'popup_purge') {
            cacheRouting = {};
            easyTempo.clearRules();
            proxyDispatch();
            reloadTabs(params.tabId, params.url);
            return;
        }

        if (action === 'popup_mode') {
            let mode = params.mode;
            easyMode = mode;
            easyStorage.mode = mode;
            proxyDispatch();
            chrome.storage.local.set({ mode });
            reloadTabs(params.tabId, params.url);
            return;
        }
    });

    port.onDisconnect.addListener(() => {
        popupPort = null;
        popupTab = null;
    });
});

function popupMessage(tabId, action, params) {
    if (tabId === popupTab) {
        popupPort.postMessage({ action, params });
    }
}

function popupRuntime(tabId, port) {
    popupTab = tabId;

    let params = {
        match: easyMatch.routing,
        tempo: easyTempo.routing,
        exclude: easyExclude.routing,
        rules: [],
        hosts: [],
        error: [],
        proxies: easyStorage.proxies,
        mode: easyStorage.mode,
        preset: easyStorage.preset
    };

    let inspect = easyInspect[tabId];

    if (inspect) {
        params.rules = Array.from(inspect.rules);
        params.hosts = Array.from(inspect.hosts);
        params.error = Array.from(inspect.error);
    }

    popupPort.postMessage({ action: 'proxy_init', params });
}

function popupSubmit(params) {
    let changes = params.changes;
    let updated = new Set();

    for (let i = 0, l = changes.length; i < l; i++) {
        let change = changes[i];
        let type = change.type;
        let proxy = change.proxy;
        let rule = change.rule;
        let profile;

        if (type === 'match') {
            updated.add(proxy);
            profile = easyMatch;
        } else if (type === 'tempo') {
            profile = easyTempo;
        } else {
            profile = easyExclude;
        }

        if (change.action === 'add') {
            profile.addRule(proxy, rule);
        } else {
            profile.removeRule(proxy, rule);
        }
    }

    for (let u of updated) {
        easyStorage[u] = easyMatch.getRules(u);
    }

    easyStorage['exclude'] = easyExclude.getRules('DIRECT');
    chrome.storage.local.set(easyStorage);
    cacheRouting = {};
    cacheExclude = {};
    proxyDispatch();
    reloadTabs(params.tabId, params.url);
}

function reloadTabs(tabId, url) {
    if (easyReload === 'none') {
        return;
    }

    if (easyReload === 'current') {
        chrome.tabs.reload(tabId);
        return;
    }

    if (easyReload === 'related') {
        let host = getHostname(url);
        url = ['http://' + host + '/*', 'https://' + host + '/*'];
    } else if (easyReload === 'all') {
        url = systemURLs;
    }

    chrome.tabs.query({ url, currentWindow: true }, (tabs) => {
        for (let i = 0, l = tabs.length; i < l; i++) {
            chrome.tabs.reload(tabs[i].id);
        }
    });
}

chrome.webNavigation.onBeforeNavigate.addListener((details) => {
    if (details.frameId === 0) {
        easyInspect[details.tabId] = { rules: new Set(), hosts: new Set(), error: new Set(), index: 0, url: details.url };
    }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    let url = changeInfo.url;

    if (!url) {
        return;
    }

    let inspect = easyInspect[tabId];

    if (!inspect || inspect.url !== url) {
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

chrome.webRequest.onBeforeRequest.addListener((details) => {
    let tabId = details.tabId;

    if (tabId === -1) {
        return;
    }

    let url = details.url;
    let inspect = easyInspect[tabId];

    if (!inspect) {
        inspect = { rules: new Set(), hosts: new Set(), error: new Set(), index: 0, url };
        easyInspect[tabId] = inspect;
    }

    let hosts = inspect.hosts;
    let rules = inspect.rules;
    let host = getHostname(url);
    let rule = cacheRules[host];

    if (rule === undefined) {
        rule = EasyProxy.makeRule(host);
        cacheRules[host] = rule;
    }

    if (!hosts.has(host)) {
        hosts.add(host);
        rules.add(rule);
        popupMessage(tabId, 'proxy_sync', { host, rule });
    }

    if (!easyNetwork || easyMode === 'direct') {
        return;
    }

    let routing = cacheRouting[host];

    if (routing === undefined) {
        routing = easyMatch.findProxy(host) || easyTempo.findProxy(host);
        cacheRouting[host] = routing;
    }

    if (routing) {
        chrome.action.setBadgeText({ tabId, text: `${++inspect.index}` });
    }
}, { urls: systemURLs });

chrome.webRequest.onErrorOccurred.addListener((details) => {
    let error = details.error;

    if (!easyHandler.has(error) || !easyPreset) {
        return;
    }

    let url = details.url;
    let host = getHostname(url);

    if (easyAction === 'none') {
        let rule = cacheRules[host];

        if (rule === undefined) {
            rule = EasyProxy.makeRule(host);
            cacheRules[host] = rule;
        }

        let error = easyInspect[tabId].error;
        error.add(host);
        error.add(rule);
        popupMessage(tabId, 'proxy_error', { host, rule });
        return;
    }

    let routing = cacheRouting[host];

    if (routing === undefined) {
        routing = easyMatch.findProxy(host) || easyTempo.findProxy(host);
        cacheRouting[host] = routing;
    }

    let exclude = cacheExclude[host];

    if (exclude === undefined) {
        exclude = easyExclude.findProxy(host);
        cacheExclude[host] = exclude;
    }

    if (routing || exclude) {
        return;
    }

    let tabId = details.tabId;

    if (easyAction === 'match') {
        easyMatch.addRule(easyPreset, host);
        clearTimeout(easyDelayed);
        easyDelayed = setTimeout(() => {
            chrome.storage.local.set({ [easyPreset]: easyMatch.getRules(easyPreset) });
        }, 3000);
    } else {
        easyTempo.addRule(easyPreset, host);
    }

    proxyDispatch();
    popupMessage(tabId, 'proxy_' + easyAction, host);
    reloadTabs(tabId, url);
}, { urls: systemURLs });

function storageDispatch(json) {
    easyStorage = json;
    easyNetwork = json.network;
    easyHandler = new Set(json.handler);
    easyAction = json.action;
    easyPreset = json.preset;
    easyReload = json.reload;
    easyMode = json.mode;
    easyExclude.addProxy('DIRECT', ['localhost', '127.0.0.1'].concat(json.exclude));
    json.exclude = easyExclude.getRules('DIRECT');
    proxyDispatch();
}

if (!chrome.action) {
    chrome.action = chrome.browserAction;
}

chrome.action.setBadgeBackgroundColor({ color: '#2940D9' });

chrome.storage.local.get(null, async (json) => {
    let storage = { ...systemStorage, ...json };
    let proxies = storage.proxies;

    for (let i = 0, l = proxies.length; i < l; i++) {
        let proxy = proxies[i];
        easyMatch.addProxy(proxy, storage[proxy]);
        easyTempo.addProxy(proxy);
    }

    storageDispatch(storage);
});
