var easyDefault = {
    direct: 'autopac',
    inicator: false,
    persistent: false,
    proxies: []
};
var easyStorage = {};
var easyMode;
var easyPersistent;

var easyMatch = {};
var easyTempo = {};
var easyTempoLog = {};

var easyRegExp;
var easyInspect = {};

var manifest = chrome.runtime.getManifest().manifest_version;
if (manifest === 3) {
    importScripts('libs/matchpattern.js');
}

chrome.runtime.onInstalled.addListener(({reason, previousVersion}) => {
    if (reason === 'update' && previousVersion === '1.1.1') {
        setTimeout(() => {
            chrome.storage.local.get(null, (json) => {
                var remove = [];
                var proxies = json.proxies;
                Object.keys(json).forEach((key) => {
                    if (!easyDefault.hasOwnProperty(key) && !proxies.includes(key)) {
                        delete json[key];
                        remove.push(key);
                    }
                });
                chrome.storage.local.remove(remove);
                chrome.storage.local.set(json);
                easyStorage = json;
                pacScriptConverter();
            });
        }, 1000);
    }
});

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
    response({
        storage: {...easyDefault, ...easyStorage},
        pac_script: easyMatch.script,
        manifest
    });
}

function easyMatchInitial(params, response) {
    response({
        storage: {...easyDefault, ...easyStorage},
        tempo: easyTempo,
        result: easyInspect[params.tabId]
    });
}

function easyPacscriptMaker({proxy}, response) {
    response({
        pac_script: convertPacScript(convertRegexp(proxy, easyStorage[proxy]))
    });
}

function easyMatchSubmit({storage, tabId}) {
    easyStorageUpdated(storage);
    easyReloadTab(tabId);
}

function easyMatchChanged({storage, removed = []}, response) {
    easyStorageUpdated(storage, response);
    chrome.storage.local.remove(removed);
    response({storage: {...easyDefault, ...easyStorage}, pac_script: easyMatch.script});
}

function easyStorageUpdated(json) {
    easyStorage = json;
    pacScriptConverter();
    chrome.storage.local.set(json);
}

function easyTempoUpdate({tempo, tabId}) {
    easyTempo = tempo;
    pacScriptConverter();
    easyReloadTab(tabId);
}

function easyTempoPurge({tabId}) {
    easyTempo = {};
    easyTempoLog = {};
    pacScriptConverter();
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
        value: { mode: "pac_script", pacScript: { data: easyMatch.extend } },
        scope: 'regular'
    });
    chrome.action.setBadgeBackgroundColor({color: '#2940D9'});
}

function easyProxyDirect() {
    chrome.proxy.settings.set({
        value: { mode: "direct" },
        scope: 'regular'
    });
    chrome.action.setBadgeBackgroundColor({color: '#C1272D'});
}

function easyProxyGlobal(proxy) {
    var [scheme, host, port] = proxy.split(/[\s:]/);
    chrome.proxy.settings.set({
        value: {
            mode: "fixed_servers",
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
        easyInspectInit(tabId, url);
    }
}, {url: [ {urlPrefix: 'http://'}, {urlPrefix: 'https://'} ]});

chrome.webNavigation.onHistoryStateUpdated.addListener(({tabId, url}) => {
    if (easyInspect?.[tabId]?.url !== url) {
        easyInspectInit(tabId, url);
    }
}, {url: [ {urlPrefix: 'http://'}, {urlPrefix: 'https://'} ]});

function easyInspectInit(tabId, url) {
    var host = new URL(url).hostname;
    var match = MatchPattern.create(host);
    easyInspect[tabId] = { host: [host], match: [match], cache: { [host]: true, [match]: true }, index: 0, result: [], url };
    easyInspectSync(tabId, host, match);
}

chrome.webRequest.onBeforeRequest.addListener(({tabId, type, url}) => {
    var host = new URL(url).hostname;
    var match = MatchPattern.create(host);
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
    chrome.runtime.sendMessage({action: 'manager_update', params: {tabId, host, match}});
}

chrome.tabs.onRemoved.addListener(({tabId}) => {
    delete easyInspect[tabId];
});

chrome.storage.local.get(null, (json) => {
    easyStorage = {...easyDefault, ...json};
    persistentModeSwitch();
    pacScriptConverter();
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

function pacScriptConverter() {
    var pac_script = '';
    var tempo = '';
    easyRegExp = '';
    easyStorage.proxies.forEach((proxy) => {
        pac_script += convertRegexp(proxy, easyStorage[proxy]);
        tempo += convertRegexp(proxy, easyTempo[proxy] ?? []);
    });
    easyMatch.script = convertPacScript(pac_script);
    easyMatch.extend = convertPacScript(pac_script + tempo);
    easyRegExp = new RegExp('^(' + easyRegExp.slice(1) + ')$', 'i');
    easyProxyMode(easyStorage.direct);
}

function convertRegexp(proxy, matches) {
    if (matches.length === 0) {
        return '';
    }
    var regexp = MatchPattern.generate(matches).string;
    easyRegExp += '|' + regexp;
    return '\n    if (/' + regexp + '/i.test(host)) {\n        return "' + proxy + '";\n    }';
}

function convertPacScript(pac_script) {
    return 'function FindProxyForURL(url, host) {' + pac_script + '\n    return "DIRECT";\n}';
}
