var easyDefault = {
    proxies: []
};
var easyStorage = {};
var easyPAC = '';
var easyPACX = '';
var easyMatch = {};
var easyTempo = {};
var easyTempoLog = {};

chrome.runtime.onMessage.addListener(({action, params}, sender, response) => {
    switch (action) {
        case 'options_plugins':
            easyPluginInit(response);
            break;
        case 'options_onchange':
            easyOptionsChanges(params, response);
            break;
        case 'easyproxy_query':
            easyToolbarQuery(params, response);
            break;
        case 'easyproxy_changetempo':
            easyTempoProxy(params);
            break;
        case 'easyproxy_purgetempo':
            easyTempoPurge(params);
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

function easyToolbarQuery(tabId, response) {
    response(easyMatch[tabId].list);
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
    if (id) {
        chrome.tabs.update(id, { url: easyMatch[id].url });
    }
}

chrome.webNavigation.onBeforeNavigate.addListener(({tabId, url, frameId}) => {
    if (frameId === 0) {
        var pattern = easyMatchPattern(url);
        easyMatch[tabId] = { list: [pattern], rule: { [pattern]: true }, url};
    }
});

chrome.webRequest.onBeforeRequest.addListener(({tabId, url}) => {
    var pattern = easyMatchPattern(url);
    if (!pattern || !easyMatch[tabId]?.rule || easyMatch[tabId].rule[pattern]) {
        return;
    }
    easyMatch[tabId].list.push(pattern);
    easyMatch[tabId].rule[pattern] = true;
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
