let easyMatch = new Map();
let easyTempo = new Map();
let easyChecks = new Map();
let easyChanges = new Set();
let easyModes = ['direct', 'autopac', 'global'];
let easyRule;
let easyHost;
let easyList = {};
let easyProxy;
let easyTab;
let easyId = 0;

let manager = document.body.classList;
let [outputPane, contextPane, proxyMenu,, menuPane, template] = document.body.children;
let [allBtn, noneBtn, defaultBtn] = contextPane.children;
let [modeMenu, submitBtn, tempoBtn, purgeBtn, expressBtn, optionsBtn] = menuPane.children;
let hostLET = template.children[0];

document.querySelectorAll('[i18n]').forEach((node) => {
    node.textContent = chrome.i18n.getMessage(node.getAttribute('i18n'));
});

document.querySelectorAll('[i18n-tips]').forEach((node) => {
    node.title = chrome.i18n.getMessage(node.getAttribute('i18n-tips'));
});

function shortcutHandler(event, button) {
    event.preventDefault();
    button.click();
}

document.addEventListener('keydown', (event) => {
    switch (event.key) {
        case 'a':
            shortcutHandler(event, allBtn);
            break;
        case 'e':
            shortcutHandler(event, noneBtn);
            break;
        case 'd':
            shortcutHandler(event, defaultBtn);
            break;
        case 'Tab':
            shortcutHandler(event, expressBtn);
            break;
        case 'Enter':
            shortcutHandler(event, submitBtn);
            break;
        case ' ':
            shortcutHandler(event, tempoBtn);
            break;
        case 'Backspace':
            shortcutHandler(event, purgeBtn);
            break;
    }
});


outputPane.addEventListener('change', (event) => {
    let check = event.target;
    easyChecks.get(check) === check.checked ? easyChanges.delete(check) : easyChanges.add(check);
});

contextPane.addEventListener('click', (event) => {
    let button = event.target.getAttribute('i18n');
    let inject = button === 'popup_all' ? true : button === 'popup_none' ? false : undefined;
    [...easyChecks].forEach(([check, value]) => {
        value = inject ?? value;
        check.checked === value ? easyChanges.delete(check) : easyChanges.add(check);
        check.checked = value;
    });
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

modeMenu.addEventListener('change', (event) => {
    let mode = event.target.value;
    let params = mode === 'global' ? proxyMenu.value : mode;
    chrome.runtime.sendMessage({action: 'easyproxy_mode', params}, () => {
        let hide = easyModes.filter((key) => key !== mode);
        manager.add(mode);
        manager.remove(...hide);
        if (mode === 'autopac' && !manager.contains('asleep')) {
            easyManagerSetup();
        }
    });
});

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
    easyChecks.forEach((value, check) => {
        check.parentNode.classList.remove('tempo');
        check.checked = easyTempo.has(check.value) ? false : value;
    });
    easyTempo.clear();
    chrome.runtime.sendMessage({action:'manager_purge', params: easyTab});
}

menuPane.addEventListener('click', (event) => {
    switch (event.target.getAttribute('i18n')) {
        case 'popup_submit':
            proxyStatusChanged('manager_update', 'match', easyMatch);
            break;
        case 'popup_tempo':
            proxyStatusChanged('manager_tempo', 'tempo', easyTempo);
            break;
        case 'popup_purge':
            menuEventPurge();
            break;
        case 'popup_express':
            outputPane.classList.toggle('express');
            break;
        case 'popup_options':
            chrome.runtime.openOptionsPage();
            break;
    };
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
        easyList.lastMatch = easyList.lastTempo = null;
        easyChecks.clear();
        outputPane.innerHTML = '';
    }
});

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
        if (direct !== 'direct' && direct !== 'autopac') {
            proxyMenu.value = easyProxy = direct;
            direct = 'global';
        }
        modeMenu.value = direct;
        manager.add(direct);
        rule.length === 0 && host.length === 0 || !easyProxy ? manager.add('asleep') : easyManagerSetup();
    });
});

function easyManagerSetup() {
    easyRule.forEach((rule) => pinrtOutputList(rule, 'wildcard'));
    easyHost.forEach((host) => pinrtOutputList(host, 'fullhost'));
}

function pinrtOutputList(value, type) {
    let {host, check} = easyList[value] ??= printMatchPattern(value, type);
    if (easyChecks.has(check)) {
        return;
    }
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
    if (match === easyProxy || tempo === easyProxy) {
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
    return {host, check};
}
