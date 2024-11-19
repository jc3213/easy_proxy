var easyDefault = {
    enabled: true,
    pacs: {},
    persistent: true,
    proxies: []
};
var easyStorage = {};
var easyTempo = {};
var easyTempoLog = {};
var easyMatch = {};
var easyInspect = {};
var easyMain = chrome.runtime.getManifest().manifest_version;

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
        case 'proxy_disabled':
            easyDisabled();
            break;
        case 'proxy_enabled':
            easyEnabled();
            break;
    }
});

function easyOptionsInitial(response) {
    response({
        storage: {...easyDefault, ...easyStorage},
        pac_script: easyMatch.script,
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

function easyEnabled() {
    easyStorage.enabled = true;
    persistentModeSwitch();
    chrome.storage.local.set(easyStorage);
    chrome.proxy.settings.set({
        value: { mode: "pac_script", pacScript: { data: easyMatch.extend } },
        scope: 'regular'
    });
}

function easyDisabled() {
    easyStorage.enabled = false;
    chrome.action.setBadgeBackgroundColor({color: '#D33A26'});
    chrome.storage.local.set(easyStorage);
    chrome.proxy.settings.set({
        value: { mode: "direct" },
        scope: 'regular'
    });
}

chrome.webNavigation.onBeforeNavigate.addListener(({tabId, url, frameId}) => {
    if (frameId === 0) {
        var host = new URL(url).hostname;
        var match = MatchPattern(host);
        easyInspect[tabId] = { host: [host], match: [match], cache: { [host]: true, [match]: true }, url };
        easyInspectSync(tabId, host, match);
    }
});

chrome.webRequest.onBeforeRequest.addListener(({tabId, url}) => {
    var host = new URL(url).hostname;
    var match = MatchPattern(host);
    var matched = easyInspect[tabId];
    if (!match || !matched) {
        return;
    }
    if (!matched.cache[host]) {
        matched.host.push(host);
        matched.cache[host] = true;
    }
    if (!matched.cache[match]) {
        matched.match.push(match);
        matched.cache[match] = true;
    }
    easyInspectSync(tabId, host, match);
}, {urls: ['http://*/*', 'https://*/*']});

function easyInspectSync(tabId, host, match) {
    chrome.runtime.sendMessage({action: 'manager_update', params: {tabId, host, match}});
    chrome.action.setBadgeText({tabId, text: 'Go'});
}

chrome.tabs.onRemoved.addListener(({tabId}) => {
    delete easyInspect[tabId];
});

chrome.storage.local.get(null, (json) => {
    easyStorage = {...easyDefault, ...json};
    persistentModeSwitch();
    pacScriptConverter();
});

function persistentModeSwitch() {
   var color = easyStorage.persistent ? '#1C4CD4' : '#1c4c7f';
   chrome.action.setBadgeBackgroundColor({color});
}

function pacScriptConverter() {
    var pac_script = '';
    var tempo = '';
    easyStorage.proxies.forEach((proxy) => {
        if (easyStorage.pacs[proxy]) {
            pac_script += '\n    ' + easyStorage[proxy].replace(/^[^{]*{/, '').replace(/(return[^}]*)?}[^}]*$/, '').trim();
        } else {
            pac_script += convertRegexp(proxy, easyStorage[proxy]);
            tempo += convertRegexp(proxy, easyTempo[proxy] ?? []);
        }
    });
    easyMatch.script = convertPacScript(pac_script);
    easyMatch.extend = convertPacScript(pac_script + tempo);
    easyEnabled();
}

function convertRegexp(proxy, matches) {
    return matches.length === 0 ? '' : '\n    if (/^(' + matches.join('|').replace(/\./g, '\\.').replace(/\\?\.?\*\\?\.?/g, '.*') + ')$/i.test(host)) {\n        return "' + proxy + '";\n    }';
}

function convertPacScript(pac_script) {
    return 'function FindProxyForURL(url, host) {' + pac_script + '\n    return "DIRECT";\n}';
}
