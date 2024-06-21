var easyDefault = {
    proxies: []
};
var easyStorage = {};
var easyPAC = '';
var easyPACX = '';
var easyPort;
var easyMatch = {};
var easyTempo = {};
var easyTempoLog = {};

chrome.runtime.onConnect.addListener((port) => {
    switch (port.name) {
        case 'easyproxy-manager':
            easyManagerInitial(port);
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
                easyTempoProxy(params);
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

function easyMatchInitial({tabId}) {
    easyPort.postMessage({
        action: 'match_respond',
        params: {
            storage: {...easyDefault, ...easyStorage},
            tempo: easyTempo,
            result: easyMatch[tabId].list
        }
    });
}

function easyMatchSubmit({storage, tabId}) {
    easyStorage = storage;
    pacScriptConverter();
    easyReloadTab(tabId);
}

function easyTempoProxy({tabId, proxy, include, exclude}) {
    if (!easyTempo[proxy]) {
        easyTempo[proxy] = [];
        easyTempoLog[proxy] = {};
    }
    var tempo = easyTempo[proxy];
    var Log = easyTempoLog[proxy];
    var result = [];
    include.forEach((rule) => {
        Log[rule] = true;
        result.push(rule);
    });
    exclude.forEach((rule) => {
        delete Log[rule];
        tempo.splice(tempo.indexOf(rule), 1);
    });
    console.log('Proxy Server: ' + proxy + '\nAdded Tempo: ' + result.join(' ') + '\nRemoved Tempo: ' + exclude.join(' '));
    tempo.push(...result);
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

chrome.runtime.onMessage.addListener(({action, params}, sender, response) => {
    switch (action) {
        case 'options_plugins':
            easyPluginInit(response);
            break;
        case 'options_onchange':
            easyOptionsChanges(params, response);
            break;
    }
});

function easyPluginInit(response) {
    response({
        storage: {...easyDefault, ...easyStorage},
        tempo: easyTempo,
        pac_script: easyPAC
    });
}

function easyOptionsChanges({storage, removed, tabId}, response) {
    easyStorage = storage;
    pacScriptConverter();
    response({pac_script: easyPAC});
    chrome.storage.local.set(storage);
    if (removed?.length > 0) {
        chrome.storage.local.remove(removed);
    }
    easyReloadTab(tabId);
}

chrome.webNavigation.onBeforeNavigate.addListener(({tabId, url, frameId}) => {
    if (frameId === 0) {
        var pattern = easyMatchPattern(url);
        easyMatch[tabId] = { list: [pattern], rule: { [pattern]: true }, url };
    }
});

chrome.webRequest.onBeforeRequest.addListener(({tabId, url}) => {
    var pattern = easyMatchPattern(url);
    if (!pattern || !easyMatch[tabId]?.rule || easyMatch[tabId].rule[pattern]) {
        return;
    }
    easyMatch[tabId].list.push(pattern);
    easyMatch[tabId].rule[pattern] = true;
    easyPort?.postMessage({action: 'match_update', params: {pattern}});
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
        if (easyStorage[proxy].length > 0) {
            pac_script += convertRegexp(proxy, easyStorage[proxy]);
        }
        if (easyTempo[proxy]?.length > 0) {
            tempo += convertRegexp(proxy, easyTempo[proxy]);
        }
    });
    easyPAC = convertPacScript(pac_script);
    easyPACX = convertPacScript(pac_script + tempo);
    setEasyProxy(easyPACX);
}

function convertRegexp(proxy, matches) {
    return '\n    if (/^(' + matches.join('|').replace(/\./g, '\\.').replace(/\\?\.?\*\\?\.?/g, '.*') + ')$/i.test(host)) {\n        return "' + proxy + '";\n    }';
}

function convertPacScript(pac_script) {
    return 'function FindProxyForURL(url, host) {' + pac_script + '\n    return "DIRECT";\n}';
}
