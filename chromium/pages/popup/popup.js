let easyMatch = new Map();
let easyTempo = new Map();
let easyExclude = new Map();
let easyRules = new Map();
let easyTypes = new Set();
let easyChanges = new Set();
let easyProxy;
let easyTab;

let manager = document.body.classList;
let [outputPane, extraPane,, menuPane, template] = document.body.children;
let [proxyMenu, switchBtn, defaultBtn] = extraPane.children;
let [modeMenu, purgeBtn, submitBtn, tempoBtn, optionsBtn] = menuPane.children;
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
        case 'Tab':
            shortcutHandler(event, switchBtn);
            break;
        case 'Enter':
            shortcutHandler(event, submitBtn);
            break;
        case ' ':
            shortcutHandler(event, purgeBtn);
            break;
        case 'Backspace':
            shortcutHandler(event, defaultBtn);
            break;
    }
});

function proxyStatusChanged(type) {
    if (type.props !== type.value) {
        easyChanges.add(type);
    } else {
        easyChanges.delete(type);
    }
    submitBtn.disabled = defaultBtn.disabled = easyChanges.size === 0;
}

outputPane.addEventListener('change', (event) => {
    proxyStatusChanged(event.target);
});

outputPane.addEventListener('wheel', (event) => {
    let { target, deltaY } = event;
    if (target.localName !== 'select') {
        return;
    }
    let index = target.selectedIndex + deltaY / 100;
    target.selectedIndex = index < 0 ? 3 : index > 3 ? 0 : index;
    proxyStatusChanged(target);
});

proxyMenu.addEventListener('change', (event) => {
    easyProxy = event.target.value;
    easyTypes.forEach((type) => {
        type.disabled = type.title !== easyProxy;
    });
});

extraPane.addEventListener('click', (event) => {
    let button = event.target.getAttribute('i18n');
    if (!button) {
        return;
    }
    switch (button) {
        case 'popup_default':
            easyChanges.forEach((type) => {
                type.value = type.props;
            });
            easyChanges.clear();
            submitBtn.disabled = defaultBtn.disabled = true;
            break;
        case 'popup_switch':
            outputPane.classList.toggle('switch'); 
            switchBtn.classList.toggle('checked');
            break;
    };
});

modeMenu.addEventListener('change', (event) => {
    let params = event.target.value;
    chrome.runtime.sendMessage({action: 'easyproxy_mode', params}, () => {
        manager.remove('direct', 'autopac', 'global');
        manager.add(params);
    });
});

function menuEventSubmit() {
    let added = [];
    let removed = [];
    let stats = { match: easyMatch, tempo: easyTempo, exclude: easyExclude };
    easyChanges.forEach((type) => {
        let { name, value, props, parentNode } = type;
        if (value !== 'direct') {
            stats[value].set(name, easyProxy);
            added.push({ type: value, rule: name });
        }
        if (props !== 'direct') {
            stats[props].delete(name);
            removed.push({ type: props, rule: name });
        }
        parentNode.classList.remove(props, 'error');
        parentNode.classList.add(value);
        type.props = value;
    });
    easyChanges.clear();
    easyTypes.clear();
    purgeBtn.disabled = easyTempo.size === 0;
    outputPane.innerHTML = '';
    chrome.runtime.sendMessage({ action: 'manager_update', params: {added, removed, proxy: easyProxy, tabId: easyTab} });
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
    purgeBtn.disabled = true;
}

menuPane.addEventListener('click', (event) => {
    let button = event.target.getAttribute('i18n');
    if (!button) {
        return;
    }
    switch (button) {
        case 'common_submit':
            menuEventSubmit();
            break;
        case 'popup_purge':
            menuEventPurge();
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
            proxyItemListing(rule, 'wildcard');
            proxyItemListing(host, 'fullhost');
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
            menu.textContent = menu.value = proxy;
            proxyMenu.append(menu);
        });
        purgeBtn.disabled = easyTempo.size === 0;
        manager.add(mode);
        rule.forEach((rule) => proxyItemListing(rule, 'wildcard'));
        host.forEach((host) => proxyItemListing(host, 'fullhost'));
        flag.forEach((flag) => easyRules.get(flag).classList.add('error'));
    });
});

function proxyItemCreate(value, stat) {
    rule = hostLET.cloneNode(true);
    let [item, type] = rule.children;
    rule.type = type;
    rule.classList.add(stat);
    item.textContent = type.name = value;
    easyRules.set(value, rule);
    return rule;
}

function proxyItemStatus(rule, type, stat, title, disabled) {
    rule.classList.add(stat);
    type.value = type.props = stat;
    type.title = title;
    type.disabled = disabled;
}

function proxyItemListing(value, stat) {
    let rule = easyRules.get(value) ?? proxyItemCreate(value, stat);
    let { type } = rule;
    if (easyTypes.has(type)) {
        return;
    }
    let match = easyMatch.get(value);
    let tempo = easyTempo.get(value);
    if (easyExclude.has(value)) {
        proxyItemStatus(rule, type, 'exclude', '', false);
    } else if (match) {
        proxyItemStatus(rule, type, 'match', match, match !== easyProxy);
    } else if (tempo) {
        proxyItemStatus(rule, type, 'tempo', tempo, tempo !== easyProxy);
    } else {
        proxyItemStatus(rule, type, 'direct', '', false);
    }
    easyTypes.add(type);
    outputPane.append(rule);
}
