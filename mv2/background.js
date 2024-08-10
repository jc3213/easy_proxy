var easyDefault = {
    pacs: {},
    proxies: []
};
var easyStorage = {};
var easyPAC = '';
var easyPACX = '';
var easyPort;
var easyMatch = {};
var easyTempo = {};
var easyTempoLog = {};

chrome.storage.local.remove('fallback');

chrome.runtime.onMessage.addListener(({action, params}, sender, response) => {
    switch (action) {
        case 'options_initial':
            easyMatchInitial(params, response);
            break;
        case 'match_submit':
            easyMatchSubmit(params);
            break;
        case 'options_onchange':
            easyMatchChanged(params, response);
            break;
        case 'tempo_update':
            easyTempoUpdate(params);
            break;
        case 'tempo_purge':
            easyTempoPurge(params);
            break;
    }
});

function easyMatchInitial(params, response) {
    response({
        storage: {...easyDefault, ...easyStorage},
        pac_script: easyPAC,
        tempo: easyTempo,
        result: easyMatch[params?.tabId]?.list ?? []
    });
}

function easyMatchSubmit({storage, tabId}) {
    easyStorageUpdated(storage);
    easyReloadTab(tabId);
}

function easyMatchChanged({storage, removed = []}, response) {
    easyStorageUpdated(storage, response);
    chrome.storage.local.remove(removed);
}

function easyStorageUpdated(json, callback) {
    easyStorage = json;
    pacScriptConverter();
    chrome.storage.local.set(json);
    callback({storage: {...easyDefault, ...easyStorage}, pac_script: easyPAC});
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
    chrome.tabs.update(id, {url: easyMatch[id].url});
}

chrome.webNavigation.onBeforeNavigate.addListener(({tabId, url, frameId}) => {
    if (frameId === 0) {
        var pattern = easyMatchPattern(url);
        easyMatch[tabId] = { list: [pattern], rule: { [pattern]: true }, url };
        easyMatchSync('match_update', tabId, pattern);
    }
});

chrome.webRequest.onBeforeRequest.addListener(({tabId, url}) => {
    var pattern = easyMatchPattern(url);
    if (!pattern || !easyMatch[tabId] || easyMatch[tabId].rule[pattern]) {
        return;
    }
    easyMatch[tabId].list.push(pattern);
    easyMatch[tabId].rule[pattern] = true;
    easyMatchSync('match_sync', tabId, pattern);
}, {urls: ['http://*/*', 'https://*/*']});

chrome.tabs.onRemoved.addListener(({tabId}) => {
    delete easyMatch[tabId];
});

function easyMatchSync(action, tabId, pattern) {
    chrome.runtime.sendMessage({action, params: {tabId, pattern}});
}

chrome.storage.local.get(null, (json) => {
    easyStorage = {...easyDefault, ...json};
    pacScriptConverter();
});

function setEasyProxy(data) {
    chrome.proxy.settings.set({
        value: {
            mode: "pac_script",
            pacScript: {data}
        },
        scope: 'regular'
    });
}

function pacScriptConverter() {
    var pac_script = '';
    var tempo = '';
    easyStorage.proxies.forEach((proxy) => {
        if (easyStorage.pacs[proxy]) {
            pac_script += '\n    ' + easyStorage[proxy].replace(/^[^{]*{/, '').replace(/return\s*"DIRECT.*$/, '').trim();
            return;
        }
        pac_script += convertRegexp(proxy, easyStorage[proxy]);
        tempo += convertRegexp(proxy, easyTempo[proxy] ?? []);
    });
    easyPAC = convertPacScript(pac_script);
    easyPACX = convertPacScript(pac_script + tempo);
    setEasyProxy(easyPACX);
}

function convertRegexp(proxy, matches) {
    return matches.length === 0 ? '' : '\n    if (/^(' + matches.join('|').replace(/\./g, '\\.').replace(/\\?\.?\*\\?\.?/g, '.*') + ')$/i.test(host)) {\n        return "' + proxy + '";\n    }';
}

function convertPacScript(pac_script) {
    return 'function FindProxyForURL(url, host) {' + pac_script + '\n    return "DIRECT";\n}';
}
