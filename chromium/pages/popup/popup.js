let easyMatch = new Map();
let easyTempo = new Map();
let easyRule = new Map();
let easyChecks = new Map();
let easyChanges = new Set();
let easyModes = ['direct', 'autopac', 'global'];
let lastMatch;
let lastTempo;
let easyProxy;
let easyTabs = new Set();
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
    easyChecks.forEach((value, check) => {
        if (inject === undefined) {
            check.checked = value;
            easyChanges.delete(check);
        } else if (inject === value) {
            check.checked = inject;
            easyChanges.delete(check);
        } else {
            check.checked = inject;
            easyChanges.add(check);
        }
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
        let rule = check.parentNode;
        let status = rule.classList[1];
        let map = mapping.get(value);
        if (status && status !== type) {
            check.checked = easyChecks.get(check);
        } else if (checked && !map) {
            mapping.set(value, proxy);
            add.push(value);
            rule.classList.add(type);
            rule.classList.remove('error');
        } else if (!checked && map) {
            mapping.delete(value);
            remove.push(value);
            rule.classList.remove(type);
        }
    });
    if (add.length !== 0 || remove.length !== 0) {
        chrome.runtime.sendMessage({ action, params: {add, remove, proxy, tabId: easyTab} });
    }
    easyChanges.clear();
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

function easyMatchUpdate({tabId, rule, host}) {
    if (easyProxy && tabId === easyTab) {
        pinrtOutputList(rule, 'wildcard');
        pinrtOutputList(host, 'fullhost');
        manager.remove('asleep');
    }
}

function easyMatchError({tabId, rule, host}) {
    if (tabId === easyTab) {
        easyRule.get(rule)?.classList?.add('error');
        easyRule.get(host)?.classList?.add('error');
    }
}

chrome.runtime.onMessage.addListener(({action, params}) => {
    switch (action) {
        case 'manager_update':
            easyMatchUpdate(params);
            break;
        case 'manager_onerror':
            easyMatchError(params);
            break;
    };
});

chrome.tabs.onUpdated.addListener((tabId, {status}, {url}) => {
    switch (status) {
        case 'loading':
            if (easyTab === tabId && !easyTabs.has(tabId)) {
                lastMatch = lastTempo = null;
                easyChecks.clear();
                outputPane.innerHTML = '';
            }
            break;
        case 'complete':
            if (easyTab === tabId) {
                easyTabs.delete(tabId);
            }
            break;
    };
});

chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    easyTab = tabs[0].id;
    chrome.runtime.sendMessage({action: 'manager_query', params: easyTab}, ({match, tempo, proxies, rule, host, error, direct}) => {
        if (proxies.length === 0 || rule.length === 0 && host.length === 0) {
            manager.add('asleep');
        }
        proxyMenu.value = easyProxy = proxies[0];
        proxies.forEach((proxy) => {
            match[proxy]?.forEach((e) => easyMatch.set(e, proxy));
            tempo[proxy]?.forEach((e) => easyTempo.set(e, proxy));
            let menu = document.createElement('option');
            menu.textContent = menu.title = menu.value = proxy;
            proxyMenu.append(menu);
        });
        if (direct !== 'direct' && direct !== 'autopac') {
            proxyMenu.value = easyProxy = direct;
            direct = 'global';
        }
        modeMenu.value = direct;
        manager.add(direct);
        rule.forEach((rule) => pinrtOutputList(rule, 'wildcard'));
        host.forEach((host) => pinrtOutputList(host, 'fullhost'));
        error.forEach((error) => easyRule.get(error).classList.add('error'));
    });
});

function pinrtOutputList(value, type) {
    let rule = easyRule.get(value) ?? printMatchPattern(value, type);
    let {check} = rule;
    if (easyChecks.has(check)) {
        return;
    }
    let match = easyMatch.get(value);
    let tempo = easyTempo.get(value);
    if (match) {
        rule.classList.add('match');
        lastMatch?.after(rule) || outputPane.insertBefore(rule, outputPane.children[0]);
        lastMatch = rule;
    } else if (tempo) {
        rule.classList.add('tempo');
        lastTempo?.after(rule) || lastMatch?.after(rule) || outputPane.insertBefore(rule, outputPane.children[0]);
        lastTempo = rule;
    } else {
        outputPane.append(rule);
    }
    if (match === easyProxy || tempo === easyProxy) {
        check.checked = true;
    }
    easyChecks.set(check, check.checked);
}

function printMatchPattern(value, type) {
    let rule = hostLET.cloneNode(true);
    let [check, label] = rule.children;
    rule.check = check;
    check.id = 'easyproxy_' + easyId ++;
    label.setAttribute('for', check.id);
    rule.title = label.textContent = check.value = value;
    rule.classList.add(type);
    easyRule.set(value, rule);
    return rule;
}
