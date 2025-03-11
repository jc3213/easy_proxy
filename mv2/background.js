var easyDefault = {
    direct: 'autopac',
    inicator: false,
    persistent: false,
    proxies: []
};

var easyStorage = {};
var easyMatch = {};
var easyTempo = {};
var easyRegExp;
var easyScript;

var easyMode;
var easyPersistent;
var easyInspect = {};

var manifest = chrome.runtime.getManifest().manifest_version;
if (manifest === 3) {
    importScripts('libs/matchpattern.js');
}

chrome.action ??= chrome.browserAction;

chrome.runtime.onMessage.addListener(({action, params}, sender, response) => {
    switch (action) {
        case 'options_initial':
            easyOptionsInitial(response);
            break;
        case 'options_onchange':
            easyMatchChanged(params, response);
            break;
        case 'options_pacscript':
            easyPacscriptMaker(params, response);
            break;
        case 'manager_initial':
            easyMatchInitial(params, response);
            break;
        case 'manager_submit':
            easyMatchSubmit(params);
            break;
        case 'manager_tempo':
            easyTempoUpdate(params);
            break;
        case 'manager_purge':
            easyTempoPurge(params);
            break;
        case 'proxy_state':
            easyProxyStatus(params, response);
            break;
        case 'persistent_mode':
            persistentModeHandler();
            break;
    }
    return true;
});

function easyOptionsInitial(response) {
    response({ storage: {...easyDefault, ...easyStorage}, manifest });
}

function easyMatchInitial(params, response) {
    response({
        storage: {...easyDefault, ...easyStorage},
        tempo: easyTempo,
        result: easyInspect[params.tabId]
    });
}

function easyPacscriptMaker(proxy, response) {
    response(convertPacScript(convertRegexp(proxy, easyStorage[proxy])));
}

function easyMatchSubmit({storage, tabId}) {
    easyStorageUpdated(storage);
    easyReloadTab(tabId);
}

function easyMatchChanged({storage, removed = []}, response) {
    MatchPattern.instances = [];
    chrome.storage.local.remove(removed);
    easyStorageUpdated(storage, response);
    response({storage: {...easyDefault, ...easyStorage}});
}

function easyStorageUpdated(json) {
    easyStorage = json;
    easyProxySetup();
    chrome.storage.local.set(json);
}

function easyTempoUpdate({tempo, tabId}) {
    easyTempo = tempo;
    easyProxyScript();
    easyReloadTab(tabId);
}

function easyTempoPurge({tabId}) {
    easyStorage.proxies.forEach((proxy) => {
        easyTempo[proxy].data = [];
    });
    easyProxyScript();
    easyReloadTab(tabId);
}

function easyReloadTab(id) {
    chrome.tabs.update(id, {url: easyInspect[id].url});
}

function easyProxyStatus(params, response) {
    easyProxyMode(params);
    easyStorage.direct = params;
    chrome.storage.local.set(easyStorage);
    response(true);
}

function easyProxyMode(mode) {
    easyMode = mode;
    switch (mode) {
        case 'autopac':
            easyProxyAutopac();
            break;
        case 'direct':
            easyProxyDirect();
            break;
        default:
            easyProxyGlobal(mode);
            break;
    };
}

function easyProxyAutopac() {
    persistentModeSwitch();
    chrome.proxy.settings.set({
        value: { mode: 'pac_script', pacScript: { data: easyScript } },
        scope: 'regular'
    });
    chrome.action.setBadgeBackgroundColor({color: '#2940D9'});
}

function easyProxyDirect() {
    chrome.proxy.settings.set({
        value: { mode: 'direct' },
        scope: 'regular'
    });
    chrome.action.setBadgeBackgroundColor({color: '#C1272D'});
}

function easyProxyGlobal(proxy) {
    var [scheme, host, port] = proxy.split(/[\s:]/);
    chrome.proxy.settings.set({
        value: {
            mode: 'fixed_servers',
            rules: {
                singleProxy: { scheme: scheme.toLowerCase(), host, port: port | 0 },
                bypassList: ['localhost']
            }
        },
        scope: 'regular'
    });
    chrome.action.setBadgeBackgroundColor({color: '#208020'});
}

chrome.webNavigation.onBeforeNavigate.addListener(({tabId, url, frameId}) => {
    if (frameId === 0) {
        easyInspectSetup(tabId, url);
    }
}, {url: [ {urlPrefix: 'http://'}, {urlPrefix: 'https://'} ]});

chrome.webNavigation.onHistoryStateUpdated.addListener(({tabId, url}) => {
    if (easyInspect?.[tabId]?.url !== url) {
        easyInspectSetup(tabId, url);
    }
}, {url: [ {urlPrefix: 'http://'}, {urlPrefix: 'https://'} ]});

function easyInspectSetup(tabId, url) {
    var host = new URL(url).hostname;
    var match = MatchPattern.make(host);
    easyInspect[tabId] = { host: [host], match: [match], cache: { [host]: true, [match]: true }, index: 0, result: [], url };
    easyInspectSync(tabId, host, match);
}

chrome.webRequest.onBeforeRequest.addListener(({tabId, type, url}) => {
    var host = new URL(url).hostname;
    var match = MatchPattern.make(host);
    var inspect = easyInspect[tabId];
    if (!match || !inspect) {
        return;
    }
    if (!inspect.cache[host]) {
        inspect.host.push(host);
        inspect.cache[host] = true;
    }
    if (!inspect.cache[match]) {
        inspect.match.push(match);
        inspect.cache[match] = true;
    }
    if (easyStorage.indicator) {
        easyProxyIndicator(tabId, host, url);
    }
    easyInspectSync(tabId, host, match);
}, {urls: [ 'http://*/*', 'https://*/*' ]});

function easyProxyIndicator(tabId, host, url) {
    if (easyMode === 'direct' || easyMode === 'autopac' && !easyRegExp.test(host)) {
        return;
    }
    easyInspect[tabId].index ++;
    easyInspect[tabId].result.push(url);
    chrome.action.setBadgeText({tabId, text: easyInspect[tabId].index + ''});
}

function easyInspectSync(tabId, host, match) {
    console.log(host, match);
    chrome.runtime.sendMessage({action: 'manager_update', params: {tabId, host, match}});
}

chrome.tabs.onRemoved.addListener(({tabId}) => {
    delete easyInspect[tabId];
});

chrome.storage.local.get(null, (json) => {
    easyStorage = {...easyDefault, ...json};
    persistentModeSwitch();
    easyProxySetup();
});

function persistentModeHandler() {
    easyStorage.persistent = !easyStorage.persistent;
    persistentModeSwitch();
}

function persistentModeSwitch() {
    if (manifest === 3 && easyStorage.persistent) {
        easyPersistent = setInterval(chrome.runtime.getPlatformInfo, 26000);
    } else {
        clearInterval(easyPersistent);
    }
}

function easyProxySetup() {
    easyStorage.proxies.forEach((proxy) => {
        var match = new MatchPattern();
        var tempo = new MatchPattern();
        match.add(easyStorage[proxy]);
        match.proxy = tempo.proxy = proxy;
        easyMatch[proxy] = match;
        easyTempo[proxy] = tempo;
    });
    easyProxyScript();
}

function easyProxyScript() {
    var merge = MatchPattern.merge();
    easyRegExp = merge.regexp;
    easyScript = merge.pac_script;
    easyProxyMode(easyStorage.direct);
}