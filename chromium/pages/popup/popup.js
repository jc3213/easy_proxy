let easyMatch = new Map();
let easyTempo = new Map();
let easyChecks = new Map();
let easyChanges = new Set();
let easyRule;
let easyHost;
let easyList = {};
let easyData = {};
let easyProxy;
let easyTab;
let easyId = 0;

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
    easyChecks.get(check) === check.checked ? easyChanges.delete(check) : easyChanges.add(check);
});

const contextHandlers = {
    'popup_all': ([check]) => contextMenuEvent(check, true),
    'popup_none': ([check]) => contextMenuEvent(check, false),
    'popup_default': ([check, value]) => contextMenuEvent(check, value)
};

function contextMenuEvent(check, value) {
    check.checked === value ? easyChanges.delete(check) : easyChanges.add(check);
    check.checked = value;
}

contextPane.addEventListener('click', (event) => {
    let handler = contextHandlers[event.target.getAttribute('i18n')];
    if (handler) {
        [...easyChecks].forEach(handler);
    }
});

proxyMenu.addEventListener('change', (event) => {
    if (easyMode === 'autopac') {
        easyChecks.forEach((check) => {
            let host = check.value;
            let match = easyMatch.get(host);
            let tempo = easyTempo.get(host);
            check.checked = match === proxy || tempo === proxy;
            check.disabled = match && match !== proxy || tempo && tempo !== proxy;
        });
    } else {
        chrome.runtime.sendMessage({action: 'easyproxy_mode', params: event.target.value});
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
    'popup_submit': () => proxyStatusChanged('manager_update', 'match', easyMatch),
    'popup_tempo': () => proxyStatusChanged('manager_tempo', 'tempo', easyTempo),
    'popup_purge': menuEventPurge,
    'popup_options': () => chrome.runtime.openOptionsPage()
};

function proxyStatusChanged(action, type, mapping) {
    if (easyChanges.size === 0) {
        return;
    }
    let proxy = proxyMenu.value;
    let add = [];
    let remove = [];
    easyChanges.forEach((check) => {
        let {value, checked} = check;
        let status = check.parentNode.classList[2];
        let map = mapping.get(value);
        if (status && status !== type) {
            check.checked = easyDefault[value];
        } else if (checked && !map) {
            mapping.set(value, proxy);
            add.push(value);
            check.parentNode.classList.add(type);
        } else if (!checked && map) {
            mapping.delete(value);
            remove.push(value);
            check.parentNode.classList.remove(type);
        }
    });
    easyChanges.clear();
    chrome.runtime.sendMessage({ action, params: {add, remove, proxy, tabId: easyTab} });
}

function menuEventPurge() {
    easyTempo = new Map();
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

chrome.runtime.onMessage.addListener(({action, params}) => {
    if (action !== 'manager_update') {
        return;
    }
    let {tabId, rule, host} = params;
    if (easyProxy && tabId === easyTab) {
        pinrtOutputList(rule, 'wildcard');
        pinrtOutputList(host, 'fullhost');
        manager.remove('asleep');
    }
});

chrome.webNavigation.onBeforeNavigate.addListener(({tabId, frameId}) => {
    if (tabId === easyTab && frameId === 0) {
        easyData = {};
        easyList.lastMatch = easyList.lastTempo = null;
        easyChecks.clear();
        outputPane.innerHTML = '';
    }
});

const proxyModeHandlers = {
    'direct': () => 'direct',
    'autopac': () => 'autopac',
    'global': (direct) => {
        proxyMenu.value = direct;
        return 'global';
    }
};

chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    easyTab = tabs[0].id;
    chrome.runtime.sendMessage({action: 'manager_query', params: easyTab}, ({match, tempo, proxies, rule, host, direct}) => {
        proxies.forEach((proxy) => {
            match[proxy].forEach((e) => easyMatch.set(e, proxy));
            tempo[proxy].forEach((e) => easyTempo.set(e, proxy));
            let menu = document.createElement('option');
            menu.textContent = menu.title = menu.value = proxy;
            proxyMenu.append(menu);
        });
        easyRule = rule;
        easyHost = host;
        easyProxy = proxies[0];
        let handler = proxyModeHandlers[direct] ?? proxyModeHandlers['global'];
        let mode = handler(direct);
        modeMenu.value = mode;
        manager.add(mode);
        rule.length === 0 && host.length === 0 || !easyProxy ? manager.add('asleep') : easyManagerSetup();
    });
});

function easyManagerSetup() {
    easyRule.forEach((rule) => pinrtOutputList(rule, 'wildcard'));
    easyHost.forEach((host) => pinrtOutputList(host, 'fullhost'));
}

function pinrtOutputList(value, type) {
    let host = easyList[value] ??= printMatchPattern(value, type);
    if (easyData[value]) {
        return;
    }
    easyData[value] = true;
    let check = host.children[0];
    let match = easyMatch.get(value);
    let tempo = easyTempo.get(value);
    if (match) {
        host.classList.add('match');
        easyList.lastMatch?.after(host) || outputPane.insertBefore(host, outputPane.children[0]);
        easyList.lastMatch = host;
    } else if (tempo) {
        host.classList.add('tempo');
        easyList.lastTempo?.after(host) || easyList.lastMatch?.after(host) || outputPane.insertBefore(host, outputPane.children[0]);
        easyList.lastTempo = host;
    } else {
        outputPane.append(host);
    }
    if (easyMatch.get(value) === easyProxy || easyTempo.get(value) === easyProxy) {
        check.checked = true;
    }
    easyChecks.set(check, check.checked);
}

function printMatchPattern(value, type) {
    let host = hostLET.cloneNode(true);
    let [check, label] = host.children;
    check.id = 'easyproxy_' + easyId ++;
    label.setAttribute('for', check.id);
    host.title = label.textContent = check.value = value;
    host.classList.add(type);
    return host;
}