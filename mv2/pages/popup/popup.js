let easyStorage = {};
let easyCache = {};
let easyTempo = {};
let easyTempoCache = {};
let easyInspect = {};
let easyHosts = [];
let easyDefault = {};
let easyList = {};
let easyProxy;
let easyTab;
let easyId = 0;
let checkboxes = [];

let manager = document.body.classList;
let [outputPane,, proxyPane,, menuPane, template] = document.body.children;
let [proxyMenu, expandBtn] = proxyPane.children;
let [modeMenu, submitBtn, tempoBtn, purgeBtn, optionsBtn] = menuPane.children;
let hostLET = template.children[0];

document.querySelectorAll('[i18n]').forEach((node) => {
    node.textContent = chrome.i18n.getMessage(node.getAttribute('i18n'));
});

document.querySelectorAll('[i18n-tips]').forEach((node) => {
    node.title = chrome.i18n.getMessage(node.getAttribute('i18n-tips'));
});

const shortcutHandlers = {
    '`': expandBtn,
    'Enter': submitBtn,
    ' ': tempoBtn,
    'Backspace': purgeBtn
};

document.addEventListener('keydown', (event) => {
    console.log(event.key);
    let handler = shortcutHandlers[event.key];
    if (handler) {
        event.preventDefault();
        handler.click();
    }
});

const optionModes = ['direct', 'autopac', 'global'];

modeMenu.addEventListener('change', (event) => {
    let mode = event.target.value;
    let proxy = proxyMenu.value;
    let params = mode === 'global' ? proxy : mode;
    chrome.runtime.sendMessage({action: 'easyproxy_mode', params}, (response) => {
        let hide = optionModes.filter((key) => key !== mode);
        manager.add(mode);
        manager.remove(...hide);
        if (mode === 'autopac' && !manager.contains('asleep')) {
            easyManagerSetup();
        }
    });
});

expandBtn.addEventListener('click', (event) => {
    checkboxes.forEach((check) => {
        check.checked = easyDefault[check.value];
    });
    manager.toggle('expand');
});

const menuEventHandlers = {
    'popup_submit': () => proxyStatusChanged('manager_update', 'match', easyStorage, easyCache),
    'popup_tempo': () => proxyStatusChanged('manager_tempo', 'tempo', easyTempo, easyTempoCache),
    'popup_purge': menuEventPurge,
    'pupop_options': () => chrome.runtime.openOptionsPage()
};

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

function menuEventPurge() {
    easyTempoCache = {};
    easyTempo = {};
    easyHosts.forEach((match) => {
        match.parentNode.classList.remove('tempo');
        match.checked = easyCache[match.value] === easyProxy ? true : false;
    });
    chrome.runtime.sendMessage({action:'manager_purge', params: easyTab});
}

menuPane.addEventListener('click', (event) => {
    let handler = menuEventHandlers[event.target.getAttribute('i18n')];
    if (handler) {
        handler();
    }
});

outputPane.addEventListener('change', (event) => {
    let entry = event.target;
    let {value, checked} = entry;
    if (easyDefault[value] === checked) {
        checkboxes = checkboxes.filter((node) => node !== entry);
    } else {
        checkboxes.push(entry);
    }
});

proxyMenu.addEventListener('change', (event) => {
    easyProxy = event.target.value;
    if (easyMode === 'autopac') {
        easyHosts.forEach((match) => {
            let host = match.value;
            match.checked = easyCache[host] === proxy || easyTempoCache[host] === proxy;
            match.disabled = easyCache[host] && easyCache[host] !== proxy || easyTempoCache[host] && easyTempoCache[host] !== proxy;
        });
    } else {
        easyStorage.direct = easyProxy;
        chrome.runtime.sendMessage({action: 'easyproxy_mode', params: easyProxy});
    }
});

chrome.runtime.onMessage.addListener((message) => {
    if (message.action !== 'manager_update') {
        return;
    }
    let {tabId, host, match} = message.params;
    if (easyProxy && tabId === easyTab) {
        easyMatchPattern(host, 'hostname');
        easyMatchPattern(match, 'wildcard');
        manager.remove('asleep');
    }
});

chrome.webNavigation.onBeforeNavigate.addListener(({tabId, frameId}) => {
    if (tabId === easyTab && frameId === 0) {
        easyList = {};
        outputPane.innerHTML = '';
    }
});

chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    easyTab = tabs[0].id;
    chrome.runtime.sendMessage({action: 'manager_query', params: {tabId: easyTab}}, ({storage, tempo, inspect}) => {
        easyInspect = inspect;
        easyStorage = storage;
        easyProxy = easyStorage.proxies[0];
        easyStorage.proxies.forEach((proxy) => {
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
        inspect.host.length === 0 && inspect.match.length === 0 || !easyProxy ? manager.add('asleep') : easyManagerSetup();
    });
});

function easyManagerSetup() {
    easyInspect.host.forEach((value) => easyMatchPattern(value, 'hostname'));
    easyInspect.match.forEach((value) => easyMatchPattern(value, 'wildcard'));
}

function easyProxyCeate(proxy) {
    let menu = document.createElement('option');
    menu.textContent = menu.title = menu.value = proxy;
    proxyMenu.append(menu);
    easyStorage[proxy].forEach((match) => easyCache[match] = proxy);
    easyTempo[proxy]?.forEach((match) => easyTempoCache[match] = proxy);
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
    if (easyCache[value]) {
        host.classList.add('match');
        easyList.lastMatch?.after(host) || outputPane.insertBefore(host, outputPane.children[0]);
        easyList.lastMatch = host;
    } else if (easyTempoCache[value]) {
        host.classList.add('tempo');
        easyList.lastTempo?.after(host) || easyList.lastMatch?.after(host) || outputPane.insertBefore(host, outputPane.children[0]);
        easyList.lastTempo = host;
    }
    if (easyCache[value] === easyProxy || easyTempoCache[value] === easyProxy) {
        entry.checked = true;
    }
    easyHosts.push(entry);
    easyId ++;
    easyList[value] = host;
    easyDefault[value] = entry.checked;
}
