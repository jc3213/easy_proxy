let easyStorage = {};
let easyCache = {};
let easyTempo = {};
let easyTempoCache = {};
let easyInspect = {};
let easyChecks = [];
let easyDefault = {};
let easyList = {};
let easyProxy;
let easyTab;
let easyId = 0;
let checkboxes = new Set();

let manager = document.body.classList;
let [outputPane, contextPane, proxyMenu,, menuPane, template] = document.body.children;
let [allBtn, noneBtn, defaultBtn] = contextPane.children;
let [modeMenu, submitBtn, tempoBtn, purgeBtn, optionsBtn] = menuPane.children;
let hostLET = template.children[0];

document.querySelectorAll('[i18n]').forEach((node) => {
    node.textContent = chrome.i18n.getMessage(node.getAttribute('i18n'));
});

document.querySelectorAll('[i18n-tips]').forEach((node) => {
    node.title = chrome.i18n.getMessage(node.getAttribute('i18n-tips'));
});

const shortcutHandlers = {
    'a': allBtn,
    'e': noneBtn,
    'd': defaultBtn,
    'Enter': submitBtn,
    ' ': tempoBtn,
    'Backspace': purgeBtn
};

document.addEventListener('keydown', (event) => {
    let handler = shortcutHandlers[event.key];
    if (handler) {
        event.preventDefault();
        handler.click();
    }
});

outputPane.addEventListener('change', (event) => {
    let check = event.target;
    let {value, checked} = check;
    easyDefault[value] === checked ? checkboxes.delete(check) : checkboxes.add(check);
});

const contextHandlers = {
    'popup_all': (check) => contextMenuEvent(check, true),
    'popup_none': (check) => contextMenuEvent(check, false),
    'popup_default': (check) => contextMenuEvent(check, easyDefault[check.value])
};

function contextMenuEvent(check, value) {
    check.checked === value ? checkboxes.delete(check) : checkboxes.add(check);
    check.checked = value;
}

contextPane.addEventListener('click', (event) => {
    let handler = contextHandlers[event.target.getAttribute('i18n')];
    if (handler) {
        let type = manager.contains('expand') ? 'hostname' : 'wildcard';
        easyChecks.forEach((check) => {
            let css = check.parentNode.classList;
            if (css.length !== 1 || css[0] === type) {
                handler(check);
            }
        });
    }
});

proxyMenu.addEventListener('change', (event) => {
    easyProxy = event.target.value;
    if (easyMode === 'autopac') {
        easyChecks.forEach((check) => {
            let host = check.value;
            check.checked = easyCache[host] === proxy || easyTempoCache[host] === proxy;
            check.disabled = easyCache[host] && easyCache[host] !== proxy || easyTempoCache[host] && easyTempoCache[host] !== proxy;
        });
    } else {
        easyStorage.direct = easyProxy;
        chrome.runtime.sendMessage({action: 'easyproxy_mode', params: easyProxy});
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

const menuEventHandlers = {
    'popup_submit': () => proxyStatusChanged('manager_update', 'match', easyStorage, easyCache),
    'popup_tempo': () => proxyStatusChanged('manager_tempo', 'tempo', easyTempo, easyTempoCache),
    'popup_purge': menuEventPurge,
    'popup_options': () => chrome.runtime.openOptionsPage()
};

function proxyStatusChanged(action, type, storage, logs) {
    if (checkboxes.size === 0) {
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
    checkboxes.clear();
    chrome.runtime.sendMessage({ action, params: {add, remove, proxy, tabId: easyTab} });
}

function menuEventPurge() {
    easyTempoCache = {};
    easyTempo = {};
    easyChecks.forEach((check) => {
        check.parentNode.classList.remove('tempo');
        check.checked = easyCache[check.value] === easyProxy ? true : false;
    });
    chrome.runtime.sendMessage({action:'manager_purge', params: easyTab});
}

menuPane.addEventListener('click', (event) => {
    let handler = menuEventHandlers[event.target.getAttribute('i18n')];
    if (handler) {
        handler();
    }
});

chrome.runtime.onMessage.addListener((message) => {
    if (message.action !== 'manager_update') {
        return;
    }
    let {tabId, host, match} = message.params;
    if (easyProxy && tabId === easyTab) {
        easyMatchPattern(match);
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
    easyInspect.match.forEach(easyMatchPattern);
}

function easyProxyCeate(proxy) {
    let menu = document.createElement('option');
    menu.textContent = menu.title = menu.value = proxy;
    proxyMenu.append(menu);
    easyStorage[proxy].forEach((match) => easyCache[match] = proxy);
    easyTempo[proxy]?.forEach((match) => easyTempoCache[match] = proxy);
}

function easyMatchPattern(value) {
    if (easyList[value]) {
        return;
    }
    let host = hostLET.cloneNode(true);
    let [check, label] = host.children;
    check.id = 'easyproxy_' + easyId;
    label.setAttribute('for', check.id);
    host.title = label.textContent = check.value = value;
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
        check.checked = true;
    }
    easyChecks.push(check);
    easyId ++;
    easyList[value] = host;
    easyDefault[value] = check.checked;
}
