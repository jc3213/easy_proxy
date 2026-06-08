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
    submitBtn.disabled = defaultBtn.disabled = easyChanges.size === 0;
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

rulesPane.addEventListener('mousedown', (event) => {
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

function popupDefault() {
    for (let check of easyChanges) {
        check.value = check.props;
    }
    easyChanges = new Set();
    submitBtn.disabled = defaultBtn.disabled = true;
}

function popupSwitch() {
    rulesPane.classList.toggle('switch'); 
    switchBtn.classList.toggle('checked');
}

const menuEvents = {
    'common_submit': popupSubmit,
    'popup_purge': popupPurge,
    'popup_options': chrome.runtime.openOptionsPage,
    'popup_default': popupDefault,
    'popup_switch': popupSwitch
};

menuPane.addEventListener('click', (event) => {
    let menu = event.target.getAttribute('i18n');
    let handler = menuEvents[menu];
    if (handler) {
        handler();
    }
});

extraPane.addEventListener('click', (event) => {
    let menu = event.target.getAttribute('i18n');
    let handler = menuEvents[menu];
    if (handler) {
        handler();
    }
});

chrome.webNavigation.onBeforeNavigate.addListener(({ tabId, frameId }) => {
    if (tabId === easyTab && frameId === 0) {
        ruleRefresh();
    }
});

chrome.tabs.onUpdated.addListener((tabId, { status, url }) => {
    if (tabId !== easyTab) {
        return;
    }
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
    mainframe.classList.add(mode);
    modeMenu.value = easyMode = mode;
    proxyMenu.value = easyPreset = message.preset || proxies[0];
    purgeBtn.disabled = Object.keys(easyTempo).length === 0;
    for (let i = 0, l = rules.length; i < l; i++) {
        ruleItem(rules[i], 'wildcard');
    }
    for (let i = 0, l = hosts.length; i < l; i++) {
        ruleItem(rules[i], 'fullhost');
    }
    let error = message.error;
    for (let i = 0, l = error.length; i < l; i++) {
        let e = error[i];
        easyRules.get(e).classList.add('error');
    }
}

const popupPort = chrome.runtime.connect({ name: 'popup' });
const popupDispatch = {
    'proxy_init': proxyInit,
    'proxy_sync': (params) => {
        let rule = params.rule;
        let host = params.host;
        ruleItem(rule, 'wildcard');
        ruleItem(host, 'fullhost');
        mainframe.classList.remove('asleep');
    },
    'proxy_error'(params) {
        let rule = easyRules.get(params.rule);
        let host = easyRules.get(params.host);
        if (host) {
            host.classList.add('error');
        }
        if (rule) {
            rule.classList.add('error');
        }
    },
    'proxy_match'(host) {
        let rule = easyRules.get(host);
        easyMatch[host] = easyPreset;
        if (rule) {
            rule.classList.add('match');
        }
    },
    'proxy_tempo'(host) {
        let rule = easyRules.get(host);
        easyTempo[host] = easyPreset;
        if (rule) {
            rule.classList.add('tempo');
        }
    }
};
popupPort.onMessage.addListener((message) => {
    let handler = popupDispatch[message.action];
    if (handler) {
        handler(message.params);
    }
});

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    let tab = tabs[0];
    easyTab = tab.id;
    easyUrl = tab.url;
    popupPort.postMessage({ action: 'popup_runtime', params: easyTab });
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
