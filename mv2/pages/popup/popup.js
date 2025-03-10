var easyStorage = {};
var easyWatch;
var easyMatch = {};
var easyMatchTempo = {};

var easyHosts = [];
var easyList = {};
var easyHistory = {};

var easyModes = ['direct', 'autopac', 'global'];
var easyProxy;
var easyTab;
var easyId = 0;

var changes = {};
var checkboxes = [];
var manager = document.body.classList;

var [output, proxyMenu, modeMenu] = document.querySelectorAll('#output, select');
var [expandBtn, submitBtn, tempoBtn, optionsBtn] = document.querySelectorAll('button');
var hostLET = document.querySelector('.template > div');

document.querySelectorAll('[i18n]').forEach((node) => {
    node.textContent = chrome.i18n.getMessage(node.getAttribute('i18n'));
});

document.querySelectorAll('[i18n-tips]').forEach((node) => {
    node.title = chrome.i18n.getMessage(node.getAttribute('i18n-tips'));
});

document.addEventListener('keydown', (event) => {
    event.preventDefault();
    switch(event.key) {
        case 'z':
            expandBtn.click();
            break;
        case 'Enter':
            submitBtn.click();
            break;
    }
});

expandBtn.addEventListener('click', (event) => {
    checkboxes.forEach((check) => {
        check.checked = easyHistory[check.value];
    });
    manager.toggle('expand');
});

modeMenu.addEventListener('change', (event) => {
    var mode = event.target.value;
    var proxy = proxyMenu.value;
    var params = mode === 'global' ? proxy : mode;
    chrome.runtime.sendMessage({action: 'proxy_state', params}, (response) => {
        var hide = easyModes.filter((key) => key !== mode);
        manager.add(mode);
        manager.remove(...hide);
        if (mode === 'autopac' && !manager.contains('asleep')) {
            easyManagerInit();
        }
    });
});

submitBtn.addEventListener('click', (event) => {
    var manage = proxyChange('match', easyStorage, easyMatch);
    if (manage) {
        proxyStatusUpdate('manager_submit', {storage: easyStorage});
    }
});

tempoBtn.addEventListener('click', (event) => {
    if (event.ctrlKey && event.altKey) {
        easyMatchTempo = {};
        easyTempo = {};
        easyHosts.forEach((match) => {
            match.parentNode.classList.remove('tempo');
            match.checked = easyMatch[match.value] === easyProxy ? true : false;
        });
        proxyStatusUpdate('manager_purge');
    } else {
        var manage = proxyChange('tempo', easyTempo, easyMatchTempo);
        if (manage) {
            proxyStatusUpdate('manager_tempo', {tempo: easyTempo});
        }
    }
});

optionsBtn.addEventListener('click', (event) => {
    chrome.runtime.openOptionsPage();
});

function proxyStatusUpdate(action, params = {}) {
    params.tabId = easyTab;
    chrome.runtime.sendMessage({action, params});
}

function proxyChange(type, storage, logs) {
    var proxy = proxyMenu.value;
    var include = [];
    var exclude = [];
    var matches = storage[proxy] || [];
    checkboxes.forEach((check) => {
        var {value, checked} = check;
        var status = check.parentNode.classList[2];
        if (status && status !== type) {
            check.checked = easyHistory[value];
        } else if (checked && !logs[value]) {
            logs[value] = proxy;
            include.push(value);
            matches.push(value);
            check.parentNode.classList.add(type);
        } else if (!checked && logs[value]) {
            delete logs[value];
            matches.splice(matches.indexOf(value), 1);
            exclude.push(value);
            check.parentNode.classList.remove(type);
        }
    });
    changes = {};
    easyHistory = {};
    checkboxes = [];
    storage[proxy] = matches;
    return include.length !== 0 || exclude.length !== 0;
}

output.addEventListener('change', (event) => {
    var entry = event.target;
    var value = entry.value;
    var checked = entry.checked;
    if (changes[value] === undefined) {
        easyHistory[value] = !checked;
        checkboxes.push(entry);
    }
    changes[value] = checked;
});

proxyMenu.addEventListener('change', (event) => {
    easyProxy = event.target.value;
    if (easyMode === 'autopac') {
        easyHosts.forEach((match) => {
            var host = match.value;
            match.checked = easyMatch[host] === proxy || easyMatchTempo[host] === proxy;
            match.disabled = easyMatch[host] && easyMatch[host] !== proxy || easyMatchTempo[host] && easyMatchTempo[host] !== proxy;
        });
    } else {
        easyStorage.direct = easyProxy;
        chrome.runtime.sendMessage({action: 'proxy_state', params: easyProxy});
    }
});

chrome.runtime.onMessage.addListener(({action, params}) => {
    switch (action) {
        case 'manager_update':
            easyMatchUpdate(params);
            break;
    }
});

function easyMatchUpdate({tabId, host, match}) {
    if (easyProxy && tabId === easyTab) {
        easyMatchPattern(host, 'hostname');
        easyMatchPattern(match, 'wildcard');
        manager.remove('asleep');
    }
}

chrome.webNavigation.onBeforeNavigate.addListener(({tabId, frameId}) => {
    if (tabId === easyTab && frameId === 0) {
        easyList = {};
        output.innerHTML = '';
    }
});

chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    easyTab = tabs[0].id;
    chrome.runtime.sendMessage({action: 'manager_initial', params: {tabId: easyTab}}, ({storage, tempo, result}) => {
        easyWatch = result;
        easyStorage = storage;
        easyTempo = tempo;
        easyStorage.proxies.forEach((proxy) => {
            easyProxy ??= proxy;
            easyProxyCeate(proxy);
        });
        var mode = storage.direct;
        if (mode === 'direct' || mode === 'autopac') {
            modeMenu.value = mode;
            manager.add(mode);
        } else {
            modeMenu.value = 'global';
            proxyMenu.value = mode;
            manager.add('global');
        }
        !easyProxy || !easyWatch ? manager.add('asleep') : easyManagerInit();
    });
});

function easyManagerInit() {
    easyWatch.host.forEach((value) => easyMatchPattern(value, 'hostname'));
    easyWatch.match.forEach((value) => easyMatchPattern(value, 'wildcard'));
}

function easyProxyCeate(proxy) {
    var menu = document.createElement('option');
    menu.textContent = menu.title = menu.value = proxy;
    proxyMenu.append(menu);
    easyStorage[proxy].forEach((match) => easyMatch[match] = proxy);
    easyTempo[proxy]?.forEach((match) => easyMatchTempo[match] = proxy);
}

function easyMatchPattern(value, type) {
    if (easyList[value]) {
        return;
    }
    var host = hostLET.cloneNode(true);
    host.classList.add(type);
    var [entry, label] = host.querySelectorAll('input, label');
    entry.id = 'easyproxy_' + easyId;
    label.setAttribute('for', entry.id);
    host.title = label.textContent = entry.value = value;
    easyHosts.push(entry);
    easyId ++;
    easyList[value] = host;
    output.append(host);
    if (easyMatch[value]) {
        host.classList.add('match');
        easyList.lastMatch?.after(host) || output.insertBefore(host, output.children[0]);
        easyList.lastMatch = host;
    } else if (easyMatchTempo[value]) {
        host.classList.add('tempo');
        easyList.lastTempo?.after(host) || easyList.lastMatch?.after(host) || output.insertBefore(host, output.children[0]);
        easyList.lastTempo = host;
    }
    if (easyMatch[value] === easyProxy || easyMatchTempo[value] === easyProxy) {
        entry.checked = true;
    }
}
