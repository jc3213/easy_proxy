let easyMatch = new Map();
let easyTempo = new Map();
let easyExclude = new Map();
let easyRules = new Map();
let easyTypes = new Set();
let easyChanges = new Set();
let easyProxy;
let easyTab;

let manager = document.body.classList;
let [outputPane, proxyMenu,, menuPane, template] = document.body.children;
let [modeMenu, purgeBtn, switchBtn, submitBtn, tempoBtn, optionsBtn] = menuPane.children;
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
            shortcutHandler(event, switchBtn);
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
    let type = event.target;
    let { name, props, value, parentNode } = type;
    let last = parentNode.classList[2];
    parentNode.className = parentNode.className.replace(last, value);
    if (props !== value) {
        easyChanges.add(type);
    } else {
        easyChanges.delete(type);
    }
});

proxyMenu.addEventListener('change', (event) => {
    easyProxy = event.target.value;
    easyRules.forEach((rule) => {
        let { title, type } = rule;
        console.log(type);
    });
});

modeMenu.addEventListener('change', (event) => {
    let params = event.target.value;
    chrome.runtime.sendMessage({action: 'easyproxy_mode', params}, () => {
        manager.remove('direct', 'autopac', 'global');
        manager.add(params);
    });
});

function proxyStatusUpdated() {
    let added = [];
    let removed = [];
    let action = { match: easyMatch, tempo: easyTempo, exclude: easyExclude };
    easyChanges.forEach((type) => {
        let { name, value, props } = type;
        if (value !== 'direct') {
            action[value].set(name, easyProxy);
            added.push({ type: value, rule: name });
        }
        if (props !== 'direct') {
            action[props].delete(name);
            removed.push({ type: props, rule: name });
        }
        type.props = value;
    });
    easyChanges.clear();
    if (added.length !== 0 || removed.length !== 0) {
        easyTypes.clear();
        outputPane.innerHTML = '';
        chrome.runtime.sendMessage({ action: 'manager_update', params: {added, removed, proxy: easyProxy, tabId: easyTab} });
    }
}

function menuEventPurge() {
    easyTempo.clear();
    easyTypes.clear();
    easyRules.forEach((rule) => {
        if (rule.classList.contains('tempo')) {
            rule.className = rule.className.replace('tempo', 'direct');
            rule.type.value = rule.type.props = 'direct';
        }
    });
    chrome.runtime.sendMessage({ action:'manager_purge', params: easyTab });
}

menuPane.addEventListener('click', (event) => {
    let button = event.target.getAttribute('i18n');
    if (!button) {
        return;
    }
    switch (button) {
        case 'popup_submit':
            proxyStatusUpdated();
            break;
        case 'popup_purge':
            menuEventPurge();
            break;
        case 'popup_switch':
            outputPane.classList.toggle('express');
            break;
        case 'popup_options':
            chrome.runtime.openOptionsPage();
            break;
    };
});

chrome.runtime.onMessage.addListener(({action, params}) => {
    let {tabId, rule, host} = params;
    if (!easyProxy || tabId !== easyTab) {
        return;
    }
    switch (action) {
        case 'manager_update':
            pinrtOutputList(rule, 'wildcard');
            pinrtOutputList(host, 'fullhost');
            manager.remove('asleep');
            break;
        case 'manager_report':
            easyRules.get(rule)?.classList?.add('error');
            easyRules.get(host)?.classList?.add('error');
            break;
        case 'manager_to_match':
            easyMatch.set(host, easyProxy);
            easyRules.get(host)?.classList?.add('match');
            break;
        case 'manager_to_tempo':
            easyTempo.set(host, easyProxy);
            easyRules.get(host)?.classList?.add('tempo');
            break;
    };
});

chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    easyTab = tabs[0].id;
    chrome.runtime.sendMessage({action: 'manager_query', params: easyTab}, ({proxies, mode, preset, match, tempo, exclude, rule, host, flag}) => {
        if (proxies.length === 0 || rule.length === 0 && host.length === 0) {
            manager.add('asleep');
        }
        modeMenu.value = mode;
        proxyMenu.value = easyProxy = preset || proxies[0];
        exclude.forEach((rule) => easyExclude.set(rule, 'DIRECT'));
        proxies.forEach((proxy) => {
            match[proxy]?.forEach((e) => easyMatch.set(e, proxy));
            tempo[proxy]?.forEach((e) => easyTempo.set(e, proxy));
            let menu = document.createElement('option');
            menu.textContent = menu.title = menu.value = proxy;
            proxyMenu.append(menu);
        });
        manager.add(mode);
        rule.forEach((rule) => pinrtOutputList(rule, 'wildcard'));
        host.forEach((host) => pinrtOutputList(host, 'fullhost'));
        flag.forEach((flag) => easyRules.get(flag).classList.add('error'));
    });
});

function pinrtOutputList(value, _type) {
    let rule = easyRules.get(value);
    if (!rule) {
        rule = hostLET.cloneNode(true);
        let [item, type] = rule.children;
        rule.type = type;
        rule.title = item.textContent = type.name = value;
        rule.classList.add(_type);
        easyRules.set(value, rule);
    }
    let { type } = rule;
    if (easyTypes.has(type)) {
        return;
    }
    if (easyExclude.has(value)) {
        rule.classList.add('exclude');
        type.value = type.props = 'exclude';
    } else if (easyMatch.has(value)) {
        rule.classList.add('match');
        type.value = type.props = 'match';
    } else if (easyTempo.has(value)) {
        rule.classList.add('tempo');
        type.value = type.props = 'tempo';
    } else {
        rule.classList.add('direct');
        type.value = type.props = 'direct';
    }
    easyTypes.add(type);
    outputPane.append(rule);
}
