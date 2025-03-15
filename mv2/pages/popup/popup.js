let easyStorage = {};
let easyMatch = {};
let easyTempo = {};
let easyMatchTempo = {};

let easyHosts = [];
let easyList = {};
let easyDefault = {};

let easyModes = ['direct', 'autopac', 'global'];
let easyProxy;
let easyTab;
let easyId = 0;

let changes = {};
let checkboxes = [];
let manager = document.body.classList;

let [outputPane, proxyMenu, modeMenu] = document.querySelectorAll('#output, select');
let [expandBtn, submitBtn, tempoBtn, optionsBtn] = document.querySelectorAll('button');
let hostLET = document.querySelector('.template > div');

document.querySelectorAll('[i18n]').forEach((node) => {
    node.textContent = chrome.i18n.getMessage(node.getAttribute('i18n'));
});

document.querySelectorAll('[i18n-tips]').forEach((node) => {
    node.title = chrome.i18n.getMessage(node.getAttribute('i18n-tips'));
});

const shortcutHandlers = {
    'z': expandBtn,
    'Enter': submitBtn
};

document.addEventListener('keydown', (event) => {
    let handler = shortcutHandlers[event.key];
    if (handler) {
        event.preventDefault();
        handler.click();
    }
});

expandBtn.addEventListener('click', (event) => {
    checkboxes.forEach((check) => {
        check.checked = easyDefault[check.value];
    });
    manager.toggle('expand');
});

modeMenu.addEventListener('change', (event) => {
    let mode = event.target.value;
    let proxy = proxyMenu.value;
    let params = mode === 'global' ? proxy : mode;
    chrome.runtime.sendMessage({action: 'easyproxy_mode', params}, (response) => {
        let hide = easyModes.filter((key) => key !== mode);
        manager.add(mode);
        manager.remove(...hide);
        if (mode === 'autopac' && !manager.contains('asleep')) {
            easyManagerSetup();
        }
    });
});

submitBtn.addEventListener('click', (event) => {
    proxyStatusChanged('manager_update', 'match', easyStorage, easyMatch);
});

tempoBtn.addEventListener('click', (event) => {
    if (event.ctrlKey && event.altKey) {
        easyMatchTempo = {};
        easyTempo = {};
        easyHosts.forEach((match) => {
            match.parentNode.classList.remove('tempo');
            match.checked = easyMatch[match.value] === easyProxy ? true : false;
        });
        chrome.runtime.sendMessage({action:'manager_purge', params: easyTab});
    } else {
        proxyStatusChanged('manager_tempo', 'tempo', easyTempo, easyMatchTempo);
    }
});

function proxyStatusChanged(action, type, storage, logs) {
    if (checkboxes.length === 0) {
        return;
    }
    let proxy = proxyMenu.value;
    let add = [];
    let remove = [];
    let matches = storage[proxy] ??= [];
    checkboxes.forEach((check) => {
        let {value, checked} = check;
        let status = check.parentNode.classList[2];
        if (status && status !== type) {
            check.checked = easyDefault[value];
        } else if (checked && !logs[value]) {
            logs[value] = proxy;
            add.push(value);
            matches.push(value);
            check.parentNode.classList.add(type);
        } else if (!checked && logs[value]) {
            delete logs[value];
            matches.splice(matches.indexOf(value), 1);
            remove.push(value);
            check.parentNode.classList.remove(type);
        }
    });
    checkboxes = [];
    chrome.runtime.sendMessage({ action, params: {add, remove, proxy, tabId: easyTab} });
}

optionsBtn.addEventListener('click', (event) => {
    chrome.runtime.openOptionsPage();
});

outputPane.addEventListener('change', (event) => {
    let entry = event.target;
    let {value, checked} = entry;
    if (easyDefault[value] === checked) {
        checkboxes = checkboxes.filter((node) => node !== entry);
    } else {
        checkboxes.push(entry);
    }
    changes[value] = checked;
});

proxyMenu.addEventListener('change', (event) => {
    easyProxy = event.target.value;
    if (easyMode === 'autopac') {
        easyHosts.forEach((match) => {
            let host = match.value;
            match.checked = easyMatch[host] === proxy || easyMatchTempo[host] === proxy;
            match.disabled = easyMatch[host] && easyMatch[host] !== proxy || easyMatchTempo[host] && easyMatchTempo[host] !== proxy;
        });
    } else {
        easyStorage.direct = easyProxy;
        chrome.runtime.sendMessage({action: 'easyproxy_mode', params: easyProxy});
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
        outputPane.innerHTML = '';
    }
});

chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    easyTab = tabs[0].id;
    chrome.runtime.sendMessage({action: 'manager_query', params: {tabId: easyTab}}, ({storage, tempo, result}) => {
        easyWatch = result;
        easyStorage = storage;
        easyStorage.proxies.forEach((proxy) => {
            easyProxy ??= proxy;
            easyTempo[proxy] = tempo[proxy].data;
            easyProxyCeate(proxy);
        });
        let mode = storage.direct;
        if (mode === 'direct' || mode === 'autopac') {
            modeMenu.value = mode;
            manager.add(mode);
        } else {
            modeMenu.value = 'global';
            proxyMenu.value = mode;
            manager.add('global');
        }
        !easyProxy || !easyWatch ? manager.add('asleep') : easyManagerSetup();
    });
});

function easyManagerSetup() {
    easyWatch.host.forEach((value) => easyMatchPattern(value, 'hostname'));
    easyWatch.match.forEach((value) => easyMatchPattern(value, 'wildcard'));
}

function easyProxyCeate(proxy) {
    let menu = document.createElement('option');
    menu.textContent = menu.title = menu.value = proxy;
    proxyMenu.append(menu);
    easyStorage[proxy].forEach((match) => easyMatch[match] = proxy);
    easyTempo[proxy]?.forEach((match) => easyMatchTempo[match] = proxy);
}

function easyMatchPattern(value, type) {
    if (easyList[value]) {
        return;
    }
    let host = hostLET.cloneNode(true);
    host.classList.add(type);
    let [entry, label] = host.children;
    entry.id = 'easyproxy_' + easyId;
    label.setAttribute('for', entry.id);
    host.title = label.textContent = entry.value = value;
    outputPane.append(host);
    if (easyMatch[value]) {
        host.classList.add('match');
        easyList.lastMatch?.after(host) || outputPane.insertBefore(host, outputPane.children[0]);
        easyList.lastMatch = host;
    } else if (easyMatchTempo[value]) {
        host.classList.add('tempo');
        easyList.lastTempo?.after(host) || easyList.lastMatch?.after(host) || outputPane.insertBefore(host, outputPane.children[0]);
        easyList.lastTempo = host;
    }
    if (easyMatch[value] === easyProxy || easyMatchTempo[value] === easyProxy) {
        entry.checked = true;
    }
    easyHosts.push(entry);
    easyId ++;
    easyList[value] = host;
    easyDefault[value] = entry.checked;
}
