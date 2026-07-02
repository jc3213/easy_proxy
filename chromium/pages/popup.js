let easyRules = new Map();
let easyChecks = new Set();
let easyChanges = new Set();
let easyMatch;
let easyTempo;
let easyExclude;
let easyRoute;
let easyMode;
let easyPreset;
let easyTab;
let easyUrl;

let mainframe = document.body;

let mainTree = mainframe.children;
let rulesPane = mainTree[0];
let extraPane = mainTree[1];
let menuPane  = mainTree[3];
let template  = mainTree[4];

let extraTree = extraPane.children;
let proxyMenu  = extraTree[0];
let switchBtn  = extraTree[1];
let defaultBtn = extraTree[2];

let menuTree = menuPane.children;
let modeMenu  = menuTree[0];
let purgeBtn  = menuTree[1];
let submitBtn = menuTree[2];

let hostLET = template.firstElementChild;

function proxyUpdate(check) {
    if (check.props !== check.value) {
        easyChanges.add(check);
    } else {
        easyChanges.delete(check);
    }

    let disabled = easyChanges.size === 0;
    submitBtn.disabled = disabled;
    defaultBtn.disabled = disabled;
}

rulesPane.addEventListener('change', (event) => {
    proxyUpdate(event.target);
});

rulesPane.addEventListener('wheel', (event) => {
    let options = event.target;

    if (options.localName !== 'select') {
        return;
    }

    event.preventDefault();
    let index = options.selectedIndex + Math.sign(event.deltaY);
    options.selectedIndex = index < 0 ? 3 : index > 3 ? 0 : index;
    proxyUpdate(options);
});

document.addEventListener('mousedown', (event) => {
    if (event.button === 1) {
        event.preventDefault();
        submitBtn.click();
    }
});

proxyMenu.addEventListener('change', (event) => {
    easyPreset = event.target.value;
});

modeMenu.addEventListener('change', (event) => {
    let mode = modeMenu.value;
    popupPort.postMessage({ action: 'popup_mode', params: { mode, tabId: easyTab, url: easyUrl } });
    mainframe.classList.replace(easyMode, mode);
    easyMode = mode;
});

extraPane.addEventListener('click', (event) => {
    let menu = event.target.getAttribute('i18n');

    if (!menu) {
        return;
    }

    if (menu === 'popup_switch') {
        rulesPane.classList.toggle('switch'); 
        switchBtn.classList.toggle('checked');
        return;
    }

    if (menu === 'popup_default') {
        for (let check of easyChanges) {
            check.value = check.props;
        }

        easyChanges = new Set();
        submitBtn.disabled = defaultBtn.disabled = true;
        return;
    }
});

menuPane.addEventListener('click', (event) => {
    let menu = event.target.getAttribute('i18n');

    if (!menu) {
        return;
    }

    if (menu === 'common_submit') {
        popupSubmit();
        return;
    }

    if (menu === 'popup_purge') {
        popupPurge();
        return;
    }

    if (menu === 'popup_options') {
        chrome.runtime.openOptionsPage();
        return;
    }
});

function popupSubmit() {
    let changes = [];

    for (let check of easyChanges) {
        let props = check.props;
        let value = check.value;
        let name = check.name;
        let parent = check.parentNode;

        if (props !== 'direct') {
            delete easyRoute[props][name];
            changes.push({ action: 'remove', type: props, proxy: check.title, rule: name });
        }

        if (value !== 'direct') {
            easyRoute[value][name] = easyPreset;
            changes.push({ action: 'add', type: value, proxy: easyPreset, rule: name });
            check.title = value === 'exclude' ? '' : easyPreset;
        }

        parent.classList.remove(props, 'error');
        parent.classList.add(value);
        check.props = value;
    }

    purgeBtn.disabled = Object.keys(easyTempo).length === 0;
    popupPort.postMessage({ action: 'popup_submit', params: { changes, tabId: easyTab, url: easyUrl } });
}

function popupPurge() {
    for (let rule of easyRules.values()) {
        if (rule.classList.contains('tempo')) {
            rule.classList.replace('tempo', 'direct');
            rule.check.value = rule.check.props = 'direct';
        }
    }

    popupPort.postMessage({ action: 'popup_purge', params: { tabId: easyTab, url: easyUrl } });
    easyTempo = {};
    easyChecks = new Set();
    purgeBtn.disabled = true;
}


chrome.webNavigation.onBeforeNavigate.addListener((details) => {
    if (details.frameId === 0 && details.tabId === easyTab) {
        ruleRefresh();
    }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (tabId !== easyTab) {
        return;
    }

    let url = changeInfo.url;

    if (url && url !== easyUrl) {
        easyUrl = url;
        ruleRefresh();
    }
});

function proxyInit(message) {
    let proxies = message.proxies;
    let rules = message.rules;
    let hosts = message.hosts;

    if (proxies.length === 0 || rules.length === 0 && hosts.length === 0) {
        mainframe.classList.add('asleep');
    }

    easyTab = message.tabId;
    easyUrl = message.url;
    easyMatch = message.match;
    easyTempo = message.tempo;
    easyExclude = message.exclude;
    easyRoute = { match: easyMatch, tempo: easyTempo, exclude: easyExclude };

    for (let i = 0, l = proxies.length; i < l; i++) {
        let menu = document.createElement('option');
        menu.textContent = menu.value = proxies[i];
        proxyMenu.append(menu);
    }

    let mode = message.mode;
    easyMode = mode;
    modeMenu.value = mode;
    mainframe.classList.add(mode);
    
    let preset = message.preset || proxies[0];
    easyPreset = preset;
    proxyMenu.value = preset;

    purgeBtn.disabled = Object.keys(easyTempo).length === 0;

    for (let i = 0, l = rules.length; i < l; i++) {
        ruleItem(rules[i], 'wildcard');
    }

    for (let i = 0, l = hosts.length; i < l; i++) {
        ruleItem(hosts[i], 'fullhost');
    }

    let error = message.error;

    for (let i = 0, l = error.length; i < l; i++) {
        let e = error[i];
        easyRules.get(e).classList.add('error');
    }
}

const popupPort = chrome.runtime.connect({ name: 'popup' });

popupPort.onMessage.addListener((message) => {
    let action = message.action;
    let params = message.params;

    if (action === 'proxy_init') {
        proxyInit(params);
        return;
    }

    if (action === 'proxy_sync') {
        let rule = params.rule;
        let host = params.host;

        ruleItem(rule, 'wildcard');
        ruleItem(host, 'fullhost');
        mainframe.classList.remove('asleep');
        return;
    }

    if (action === 'proxy_error') {
        let rule = easyRules.get(params.rule);
        let host = easyRules.get(params.host);

        if (host) {
            host.classList.add('error');
        }

        if (rule) {
            rule.classList.add('error');
        }

        return;
    }

    if (action === 'proxy_match') {
        let rule = easyRules.get(params);
        easyMatch[host] = easyPreset;

        if (rule) {
            rule.classList.add('match');
        }

        return;
    }

    if (action === 'proxy_tempo') {
        let rule = easyRules.get(params);
        easyTempo[host] = easyPreset;

        if (rule) {
            rule.classList.add('tempo');
        }

        return;
    }
});

function ruleRefresh() {
    easyChecks = new Set();
    easyChanges = new Set();
    rulesPane.innerHTML = '';
    submitBtn.disabled = defaultBtn.disabled = true;
}

function ruleCreate(value, type) {
    let rule = hostLET.cloneNode(true);
    let tree = rule.children;
    let label = tree[0];
    let check = tree[1];
    rule.check = check;
    rule.classList.add(type);
    label.textContent = check.name = value;
    easyRules.set(value, rule);
    return rule;
}

function ruleItem(value, type) {
    let rule = easyRules.get(value);

    if (!rule) {
        rule = ruleCreate(value, type);
    }

    let check = rule.check;

    if (easyChecks.has(check)) {
        return;
    }

    let match = easyMatch[value];
    let tempo = easyTempo[value];
    let props = 'direct';
    let proxy = '';

    if (easyExclude[value]) {
        props = 'exclude'
        proxy = 'DIRECT';
    } else if (match) {
        props = 'match'
        proxy = match;
    } else if (tempo) {
        props = 'tempo'
        proxy = tempo;
    }

    rule.classList.add(props);
    check.value = check.props = props;
    check.title = proxy;
    easyChecks.add(check);
    rulesPane.append(rule);
}
