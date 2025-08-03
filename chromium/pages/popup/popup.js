let easyMatch = new Map();
let easyTempo = new Map();
let easyRules = new Map();
let easyChecks = new Map();
let easyChanges = new Set();
let easyExclude;
let lastMatch;
let lastTempo;
let easyProxy;
let easyTabs = new Set();
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
    let { name, prop, value, parentNode } = event.target;
    let last = parentNode.classList[2];
    parentNode.className = parentNode.className.replace(last, value);
    console.log(name, prop, value);
});

proxyMenu.addEventListener('change', (event) => {
    
});

modeMenu.addEventListener('change', (event) => {
    let params = event.target.value;
    chrome.runtime.sendMessage({action: 'easyproxy_mode', params}, () => {
        manager.remove('direct', 'autopac', 'global');
        manager.add(params);
    });
});

function proxyStatusChanged() {
    if (easyChanges.size === 0) {
        return;
    }

    easyChanges.clear();
}

function menuEventPurge() {
    chrome.runtime.sendMessage({action:'manager_purge', params: easyTab});
    easyTempo.clear();
    easyRules.forEach((rule) => {
        if (rule.classList.contains('tempo')) {
            rule.className = rule.className.replace('tempo', 'direct');
            rule.type.value = rule.type.prop = 'direct';
        }
    });
}

menuPane.addEventListener('click', (event) => {
    let button = event.target.getAttribute('i18n');
    if (!button) {
        return;
    }
    switch (button) {
        case 'popup_submit':
            proxyStatusChanged();
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

chrome.tabs.onUpdated.addListener((tabId, {status}, {url}) => {
    switch (status) {
        case 'loading':
            if (easyTab === tabId && !easyTabs.has(tabId)) {
                easyTabs.add(tabId);
                easyRules.clear();
                lastMatch = lastTempo = null;
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
    chrome.runtime.sendMessage({action: 'manager_query', params: easyTab}, ({proxies, mode, preset, match, tempo, exclude, rule, host, flag}) => {
        if (proxies.length === 0 || rule.length === 0 && host.length === 0) {
            manager.add('asleep');
        }
        easyExclude = new Set(exclude);
        modeMenu.value = mode;
        proxyMenu.value = easyProxy = preset || proxies[0];
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

function pinrtOutputList(value, cate) {
    let rule = easyRules.get(value);
    if (!rule) {
        rule = hostLET.cloneNode(true);
        let [item, type] = rule.children;
        rule.type = type;
        rule.item = item;
        rule.title = item.textContent = type.name = value;
        rule.classList.add(cate);
        easyRules.set(value, rule);
        outputPane.append(rule);
    }
    let { type } = rule;
    let match = easyMatch.get(value);
    let tempo = easyTempo.get(value);
    if (easyExclude.has(value)) {
        rule.classList.add('exclude');
        type.value = type.prop = 'exclude';
    } else if (match) {
        rule.classList.add('match');
        type.value = type.prop = 'match';
    } else if (tempo) {
        rule.classList.add('tempo');
        type.value = type.prop = 'tempo';
    } else {
        rule.classList.add('direct');
        type.value = type.prop = 'direct';
    }
}
