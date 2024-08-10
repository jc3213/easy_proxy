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

chrome.runtime.onConnect.addListener((port) => {
    switch (port.name) {
        case 'easyproxy-manager':
            easyManagerInitial(port);
            break;
        case 'easyproxy-options':
            easyOptionsInitial(port);
            break;
    }
});

function easyManagerInitial(port) {
    easyPort = port;
    port.onMessage.addListener(({action, params}) => {
        switch (action) {
            case 'match_initial':
                easyMatchInitial(params);
                break;
            case 'match_submit':
                easyMatchSubmit(params);
                break;
            case 'tempo_update':
                easyTempoUpdate(params);
                break;
            case 'tempo_purge':
                easyTempoPurge(params);
                break;
    }
    });
    port.onDisconnect.addListener(() => {
        easyPort = null;
    });
}

function easyOptionsInitial(port) {
    port.postMessage(easyOptionsSyncData('options_initial'));
    port.onMessage.addListener(({storage, removed}) => {
        easyStorageUpdated(storage);
        if (removed?.length !== 0) {
            chrome.storage.local.remove(removed);
        }
        port.postMessage(easyOptionsSyncData('options_update'));
    });
}

function easyOptionsSyncData(action) {
    return {
        action,
        params: {
            storage: {...easyDefault, ...easyStorage},
            pac_script: easyPAC
        }
    };
}

function easyStorageUpdated(json) {
    easyStorage = json;
    pacScriptConverter();
    chrome.storage.local.set(json);
}

function easyMatchInitial({tabId}) {
    easyPort.postMessage({
        action: 'match_respond',
        params: {
            storage: {...easyDefault, ...easyStorage},
            tempo: easyTempo,
            result: easyMatch[tabId]?.list
        }
    });
}

function easyMatchSubmit({storage, tabId}) {
    easyStorageUpdated(storage);
    easyReloadTab(tabId);
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
        easyPort?.postMessage({action: 'match_resync', params: {tabId, pattern}});
    }
});

chrome.webRequest.onBeforeRequest.addListener(({tabId, url}) => {
    var pattern = easyMatchPattern(url);
    if (!pattern || !easyMatch[tabId]?.rule || easyMatch[tabId].rule[pattern]) {
        return;
    }
    easyMatch[tabId].list.push(pattern);
    easyMatch[tabId].rule[pattern] = true;
    easyPort?.postMessage({action: 'match_update', params: {tabId, pattern}});
}, {urls: ['http://*/*', 'https://*/*']});

chrome.tabs.onRemoved.addListener(({tabId}) => {
    delete easyMatch[tabId];
});

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
            pac_script += easyStorage[proxy].replace(/^[^{]*{/, '').replace(/}[^}]*$/, '');
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
