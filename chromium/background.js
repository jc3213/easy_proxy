let easyDefault = {
    mode: 'autopac',
    preset: null,
    network: false,
    action: 'none',
    handler: [ 'net::ERR_CONNECTION_REFUSED', 'net::ERR_CONNECTION_RESET', 'net::ERR_CONNECTION_TIMED_OUT', 'net::ERR_NAME_NOT_RESOLVED' ],
    proxies: [],
    exclude: []
};
let easyColor = {
    direct: '#2940D9',
    autopac: '#C1272D',
    global: '#208020'
};

let firefox = typeof browser !== 'undefined';

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
    easyOptionDispatch();
    chrome.storage.local.remove([...invalid, ...removed]);
    chrome.storage.local.set(json);
}

function easyManageQuery(response, tabId) {
    let match = {}
    let tempo = {};
    let { proxies, mode, preset, exclude } = easyStorage;
    let inspect = easyInspect[tabId];
    if (!inspect) {
        response({ match, tempo, exclude, rule: [], host: [], flag: [], proxies, mode, preset });
        return;
    }
    proxies.forEach((proxy) => {
        match[proxy] = easyMatch[proxy].data;
        tempo[proxy] = easyTempo[proxy].data;
    });
    let { rule, host, flag } = inspect;
    response({ match, tempo, exclude, rule: [...rule], host: [...host], flag: [...flag], proxies, mode, preset });
}

const manageDispatch = {
    'match': (proxy) => easyMatch[proxy],
    'tempo': (proxy) => easyTempo[proxy],
    'exclude': () => easyExclude
};

function easyManagerUpdated(response, { added, removed, tabId }) {
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
    easyProxyMode();
    chrome.storage.local.set(easyStorage);
    chrome.tabs.reload(tabId);
}

function easyTempoPurged(response, tabId) {
    easyStorage.proxies.forEach((proxy) => easyTempo[proxy].clear());
    easyProxyMode();
    chrome.tabs.reload(tabId);
}

function easyModeChanger(response, params) {
    easyStorage.mode = params;
    chrome.storage.local.set(easyStorage);
    easyProxyMode();
    response(true);
}

const messageDispatch = {
    'storage_query': (response) => response(easyStorage),
    'storage_update': easyStorageUpdated,
    'pacscript_query': (response, params) => response(easyMatch[params].pacScript),
    'manager_query': easyManageQuery,
    'manager_update': easyManagerUpdated,
    'manager_purge': easyTempoPurged,
    'easyproxy_mode': easyModeChanger
};

chrome.runtime.onMessage.addListener(({ action, params }, sender, response) => {
    messageDispatch[action]?.(response, params);
    return true;
});

const modeHandlers = {
    'HTTP': (url) => ({ http: 'http://' + url }),
    'HTTPS': (url) => ({ ssl: 'https://' + url }),
    'SOCKS': (url) => ({ socks: 'socks://' + url, socksVersion: 4 }),
    'SOCKS5': (url) => ({ socks: 'socks://' + url, socksVersion: 5 }),
    'firefox': {
        'autopac': () => ({ proxyType: 'autoConfig', autoConfigUrl: 'data:,' + EasyProxy.pacScript }),
        'direct': () => ({ proxyType: 'none' }),
        'global': () => {
            let proxy = easyStorage.preset ?? easyStorage.proxies[0];
            let [scheme, url] = proxy.split(' ');
            let config = modeHandlers[scheme](url);
            config.proxyType = 'manual';
            config.passthrough = 'localhost, 127.0.0.1';
            return config;
        }
    },
    'chromium': {
        'autopac': () => ({ mode: 'pac_script', pacScript: { data: EasyProxy.pacScript } }),
        'direct': () => ({ mode: 'direct' }),
        'global': () => {
            let proxy = easyStorage.preset ?? easyStorage.proxies[0];
            let [scheme, host, port] = proxy.split(/[\s:]/);
            let singleProxy = { scheme: scheme.toLowerCase(), host, port: port | 0 };
            return { mode: 'fixed_servers', rules: { singleProxy, bypassList: ['localhost', '127.0.0.1'] } };
        }
    }
};

function easyProxyMode() {
    let { mode } = easyStorage;
    let color = easyColor[mode];
    let value = firefox ? modeHandlers['firefox'][mode]() : modeHandlers['chromium'][mode]();
    easyMode = mode;
    chrome.proxy.settings.set({ value });
    chrome.action.setBadgeBackgroundColor({ color });
}

chrome.action ??= chrome.browserAction;

chrome.tabs.onRemoved.addListener((tabId) => {
    delete easyInspect[tabId];
});

chrome.tabs.onUpdated.addListener((tabId, { url }) => {
    if (url) {
        delete easyInspect[tabId];
    }
});

chrome.webRequest.onBeforeRequest.addListener(({ tabId, type, url }) => {
    let inspect = easyInspect[tabId] ??= { rule: new Set(), host: new Set(), flag: new Set(), index: 0 };
    let { host, rule } = inspectRequest('network_update', tabId, url);
    inspect.rule.add(rule);
    inspect.host.add(host);
    if (easyNetwork) {
        inspect.index = easyNetworkCounter(tabId, inspect.index, host);
    }
}, { urls: ['http://*/*', 'https://*/*'] });

function inspectRequest(action, tabId, url) {
    let data = url.split('/')[2];
    let host = data.includes('@') ? data.slice(data.indexOf('@') + 1) : data;
    let rule = EasyProxy.make(host);
    chrome.runtime.sendMessage({ action, params: { tabId, rule, host } });
    return { host, rule };
}

function actionHandler(action, proxy, tabId, host) {
    if (!easyExclude.test(host)) {
        proxy.add(host);
        easyProxyMode();
        chrome.runtime.sendMessage({ action, params: { tabId, host } });
    }
}

const actionMap = {
    'none': () => {
        let { flag } = easyInspect[tabId];
        flag.add(rule);
        flag.add(host);
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

function easyNetworkCounter(tabId, index, host) {
    if (easyMode === 'direct' || !EasyProxy.test(host)) {
        return 0;
    }
    chrome.action.setBadgeText({ tabId, text: String(++index) });
    return index;
}

function easyOptionDispatch() {
    easyNetwork = easyStorage.network;
    easyHandler = new Set(easyStorage.handler);
    easyAction = easyStorage.action;
    easyExclude.new(easyStorage.exclude);
    easyProxyMode();
}

chrome.storage.local.get(null, async (json) => {
    easyStorage = {...easyDefault, ...json};
    easyStorage.proxies.forEach((proxy) => {
        easyMatch[proxy] = new EasyProxy(proxy);
        easyTempo[proxy] = new EasyProxy(proxy);
        easyMatch[proxy].new(easyStorage[proxy]);
    });
    easyOptionDispatch();
});
