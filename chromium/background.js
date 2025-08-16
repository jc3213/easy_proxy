let easyDefault = {
    mode: 'autopac',
    preset: null,
    network: false,
    persistent: false,
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

let easyStorage = {};
let easyHandler;
let easyNetwork;
let easyAction;
let easyMatch = {};
let easyTempo = {};
let easyExclude = new MatchPattern();
let easyRegExp;
let easyMode;
let easyScript;
let easyPersistent;
let easyTabs = new Set();
let easyInspect = {};

let manifest = chrome.runtime.getManifest().manifest_version;
let firefox = typeof browser !== 'undefined';
if (manifest === 3) {
    importScripts('libs/matchpattern.js');
}

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
            easyMatch[key] = new MatchPattern();
            easyTempo[key] = new MatchPattern();
            easyMatch[key].proxy = key;
            easyTempo[key].proxy = key;
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
    MatchPattern.delete(removed);
    easyStorage = json;
    easyStorageInit(json);
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

function easyManagerUpdated(response, {added, removed, proxy, tabId}) {
    let stats = { match: easyMatch[proxy], tempo: easyTempo[proxy], exclude: easyExclude };
    added.forEach(({ type, rule }) => {
        stats[type].add(rule);
    });
    removed.forEach(({ type, rule }) => {
        stats[type].delete(rule);
    });
    easyStorage[proxy] = stats.match.data;
    easyStorage['exclude'] = easyExclude.data;
    easyProxyScript();
    chrome.storage.local.set(easyStorage);
    chrome.tabs.reload(tabId);
}

function easyTempoPurged(response, tabId) {
    easyStorage.proxies.forEach((proxy) => easyTempo[proxy].clear());
    easyProxyScript();
    chrome.tabs.reload(tabId);
}

function easyModeChanger(response, params) {
    easyStorage.mode = params;
    chrome.storage.local.set(easyStorage);
    easyProxyMode();
}

const messageHandlers = {
    'storage_query': (response) => response({ storage: easyStorage, manifest }),
    'storage_update': easyStorageUpdated,
    'pacscript_query': (response, params) => response(easyMatch[params].pac_script),
    'manager_query': easyManageQuery,
    'manager_update': easyManagerUpdated,
    'manager_purge': easyTempoPurged,
    'easyproxy_mode': easyModeChanger
};

chrome.runtime.onMessage.addListener(({ action, params }, sender, response) => {
    messageHandlers[action]?.(response, params);
    return true;
});

const modeHandlers = {
    'HTTP': (url) => ({ http: 'http://' + url }),
    'HTTPS': (url) => ({ ssl: 'https://' + url }),
    'SOCKS': (url) => ({ socks: 'socks://' + url, socksVersion: 4 }),
    'SOCKS5': (url) => ({ socks: 'socks://' + url, socksVersion: 5 }),
    'firefox': {
        'autopac': () => ({ proxyType: 'autoConfig', autoConfigUrl: 'data:,' + easyScript }),
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
        'autopac': () => ({ mode: 'pac_script', pacScript: { data: easyScript } }),
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
    let {mode} = easyStorage;
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

const tabHandlers = {
    'loading': (tabId, url) => {
        if (url.startsWith('http') && !easyTabs.has(tabId)) {
            easyTabs.add(tabId);
            let {host, rule} = easyMatchInspect('manager_update', tabId, url);
            easyInspect[tabId] = { rule: new Set([rule]), host: new Set([host]), flag: new Set(), index: 0, url };
        }
    },
    'complete': (tabId) => easyTabs.delete(tabId)
};

chrome.tabs.onUpdated.addListener((tabId, { status }, { url }) => {
    tabHandlers[status]?.(tabId, url);
});

chrome.webRequest.onBeforeRequest.addListener(({tabId, type, url}) => {
    let inspect = easyInspect[tabId] ??= { rule: new Set(), host: new Set(), flag: new Set(), index: 0 };
    let {host, rule} = easyMatchInspect('manager_update', tabId, url);
    inspect.rule.add(rule);
    inspect.host.add(host);
    if (easyNetwork) {
        inspect.index = easyNetworkCounter(tabId, inspect.index, host);
    }
}, {urls: [ 'http://*/*', 'https://*/*' ]});

const automateMap = {
    'none': () => {
        let { flag } = easyInspect[tabId];
        flag.add(rule);
        flag.add(host);
    },
    'match': (tabId, preset, host) => easyMatchAction('manager_to_match', easyMatch[preset], tabId, host),
    'tempo': (tabId, preset, host) => easyMatchAction('manager_to_tempo', easyTempo[preset], tabId, host)
};

chrome.webRequest.onErrorOccurred.addListener(({tabId, error, url}) => {
    if (!easyHandler.has(error)) {
        return;
    }
    let { preset } = easyStorage;
    if (!preset) {
        return;
    }
    let { host, rule } = easyMatchInspect('manager_report', tabId, url);
    automateMap[easyAction]?.(tabId, preset, host, rule);
}, {urls: [ 'http://*/*', 'https://*/*' ]});

function easyMatchAction(action, proxy, tabId, host) {
    if (!easyExlude.test(host)) {
        proxy.add(host);
        easyProxyScript();
        chrome.runtime.sendMessage({action, params: { tabId, host }});
    }
}

function easyMatchInspect(action, tabId, url) {
    let host = url.match(/^(?:(?:http|ftp|ws)s?:?\/\/)?(([^./:]+\.)+[^./:]+)(?::\d+)?\/?/)[1];
    let rule = MatchPattern.make(host);
    chrome.runtime.sendMessage({action, params: { tabId, rule, host }});
    return {host, rule};
}

function easyNetworkCounter(tabId, index, host) {
    if (easyMode === 'direct' || !easyRegExp.test(host)) {
        return 0;
    }
    chrome.action.setBadgeText({tabId, text: String(++index)});
    return index;
}

chrome.storage.local.get(null, async (json) => {
    easyStorage = {...easyDefault, ...json};
    easyStorage.proxies.forEach((proxy) => {
        let match = new MatchPattern();
        let tempo = new MatchPattern();
        match.proxy = tempo.proxy = proxy;
        match.new(easyStorage[proxy]);
        easyMatch[proxy] = match;
        easyTempo[proxy] = tempo;
    });
    easyStorageInit(easyStorage);
});

function easyStorageInit(json) {
    easyNetwork = json.network;
    easyHandler = new Set(json.handler);
    easyAction = json.action;
    easyExclude.new(json.exclude);
    easyProxyScript();
    if (manifest === 3 && json.persistent) {
        easyPersistent = setInterval(chrome.runtime.getPlatformInfo, 26000);
    } else {
        clearInterval(easyPersistent);
    }
}

function easyProxyScript() {
    let result = MatchPattern.combine();
    easyScript = result.pac_script;
    easyRegExp = result.regexp;
    easyProxyMode();
}
