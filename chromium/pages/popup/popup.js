let easyMatch = new Map();
let easyTempo = new Map();
let easyExclude = new Map();
let easyStats = { match: easyMatch, tempo: easyTempo, exclude: easyExclude };
let easyRules = new Map();
let easyTypes = new Set();
let easyChanges = new Set();
let easyMode;
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

const shortcutMap = {
    'Tab': () => switchBtn.click(),
    'Enter': () => submitBtn.click(),
    'Escape': (event) => shortcutHandler(event, defaultBtn),
    'Backspace': () => purgeBtn.click()
};

document.addEventListener('keydown', (event) => {
    shortcutMap[event.key]?.(event);
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

outputPane.addEventListener('mousedown', (event) => {
    if (event.button === 1) {
        event.preventDefault();
        submitBtn.click();
    }
});

proxyMenu.addEventListener('change', (event) => {
    easyProxy = event.target.value;
});

modeMenu.addEventListener('change', (event) => {
    let params = event.target.value;
    chrome.runtime.sendMessage({ action: 'easyproxy_mode', params }, () => {
        manager.replace(easyMode, params);
        easyMode = params;
    });
});

function menuEventSubmit() {
    let added = [];
    let removed = [];
    easyChanges.forEach((type) => {
        let { name, value, props, title, parentNode } = type;
        if (props !== 'direct') {
            easyStats[props].delete(name);
            removed.push({ type: props, proxy: title, rule: name });
        }
        if (value !== 'direct') {
            easyStats[value].set(name, easyProxy);
            added.push({ type: value, proxy: easyProxy, rule: name });
            type.title = value === 'exclude' ? '' : easyProxy;
        }
        parentNode.classList.remove(props, 'error');
        parentNode.classList.add(value);
        type.props = value;
    });
    easyChanges.clear();
    easyTypes.clear();
    submitBtn.disabled = defaultBtn.disabled = true;
    purgeBtn.disabled = easyTempo.size === 0;
    outputPane.innerHTML = '';
    chrome.runtime.sendMessage({ action: 'manager_update', params: { added, removed, tabId: easyTab } });
}

function menuEventPurge() {
    easyTempo.clear();
    easyTypes.clear();
    easyRules.forEach((rule) => {
        if (rule.classList.contains('tempo')) {
            rule.classList.replace('tempo', 'direct');
            rule.type.value = rule.type.props = 'direct';
        }
    });
    chrome.runtime.sendMessage({ action:'manager_purge', params: easyTab });
    purgeBtn.disabled = true;
}

function extraEventDefault() {
    easyChanges.forEach(type => {
        type.value = type.props;
    });
    easyChanges.clear();
    submitBtn.disabled = defaultBtn.disabled = true;
}

function extraEventSwitch() {
    outputPane.classList.toggle('switch'); 
    switchBtn.classList.toggle('checked');
}

const menuEventMap = {
    'common_submit': menuEventSubmit,
    'popup_purge': menuEventPurge,
    'popup_options': () => chrome.runtime.openOptionsPage(),
    'popup_default': extraEventDefault,
    'popup_switch': extraEventSwitch
};

menuPane.addEventListener('click', (event) => {
    let menu = event.target.getAttribute('i18n');
    menuEventMap[menu]?.();
});

extraPane.addEventListener('click', (event) => {
    let menu = event.target.getAttribute('i18n');
    menuEventMap[menu]?.();
});

function messageHandler({ tabId, rule, host }, callback) {
    if (easyProxy && tabId === easyTab) {
        callback(host, rule);
    }
}

const messageDispatch = {
    'network_update': (params) => messageHandler(params, (host, rule) => {
        proxyItemListing(rule, 'wildcard');
        proxyItemListing(host, 'fullhost');
        manager.remove('asleep');
    }),
    'network_error': (params) => messageHandler(params, (host, rule) => {
        easyRules.get(rule)?.classList?.add('error');
        easyRules.get(host)?.classList?.add('error');
    }),
    'network_match': (params) => messageHandler(params, (host) => {
        easyMatch.set(host, easyProxy);
        easyRules.get(host)?.classList?.add('match');
    }),
    'network_tempo': (params) => messageHandler(params, (host) => {
        easyTempo.set(host, easyProxy);
        easyRules.get(host)?.classList?.add('tempo');
    })
};

chrome.runtime.onMessage.addListener(({ action, params }) => {
    messageDispatch[action]?.(params);
});

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    easyTab = tabs[0].id;
    chrome.runtime.sendMessage({ action: 'manager_query', params: easyTab }, ({ proxies, mode, preset, match, tempo, exclude, rule, host, flag }) => {
        if (proxies.length === 0 || rule.length === 0 && host.length === 0) {
            manager.add('asleep');
        }
        modeMenu.value = easyMode = mode;
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

function proxyItemStatus(rule, type, stat, title) {
    rule.classList.add(stat);
    type.value = type.props = stat;
    type.title = title;
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
        proxyItemStatus(rule, type, 'exclude', '');
    } else if (match) {
        proxyItemStatus(rule, type, 'match', match);
    } else if (tempo) {
        proxyItemStatus(rule, type, 'tempo', tempo);
    } else {
        proxyItemStatus(rule, type, 'direct', '');
    }
    easyTypes.add(type);
    outputPane.append(rule);
}
