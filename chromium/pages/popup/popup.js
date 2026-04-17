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

let manager = document.body;
let [rulesPane, extraPane,, menuPane, template] = manager.children;
let [proxyMenu, switchBtn, defaultBtn] = extraPane.children;
let [modeMenu, purgeBtn, submitBtn] = menuPane.children;
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
    let { target, deltaY } = event;
    if (target.localName !== 'select') {
        return;
    }
    event.preventDefault();
    let index = target.selectedIndex + Math.sign(deltaY);
    target.selectedIndex = index < 0 ? 3 : index > 3 ? 0 : index;
    proxyUpdate(target);
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
    popupPort.postMessage({ action: 'popup_mode', params: mode });
    manager.classList.replace(easyMode, mode);
    easyMode = mode;
});

function popupSubmit() {
    let changes = [];
    for (let check of easyChanges) {
        let { name, value, props, title, parentNode } = check;
        if (props !== 'direct') {
            delete easyRoute[props][name];
            changes.push({ action: 'remove', type: props, proxy: title, rule: name });
        }
        if (value !== 'direct') {
            easyRoute[value][name] = easyPreset;
            changes.push({ action: 'add', type: value, proxy: easyPreset, rule: name });
            check.title = value === 'exclude' ? '' : easyPreset;
        }
        parentNode.classList.remove(props, 'error');
        parentNode.classList.add(value);
        check.props = value;
    }
    purgeBtn.disabled = Object.keys(easyTempo).length === 0;
    popupPort.postMessage({ action: 'popup_submit', params: { changes, url: easyUrl } });
}

function popupPurge() {
    for (let rule of easyRules.values()) {
        if (rule.classList.contains('tempo')) {
            rule.classList.replace('tempo', 'direct');
            rule.check.value = rule.check.props = 'direct';
        }
    }
    popupPort.postMessage({ action: 'popup_purge', params: easyUrl });
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
    menuEvents[menu]?.();
});

extraPane.addEventListener('click', (event) => {
    let menu = event.target.getAttribute('i18n');
    menuEvents[menu]?.();
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

function proxyInit({ proxies, mode, preset, match, tempo, exclude, hosts, rules, error }) {
    if (proxies.length === 0 || rules.length === 0 && hosts.length === 0) {
        manager.classList.add('asleep');
    }
    manager.classList.add(mode);
    easyMatch = match;
    easyTempo = tempo;
    easyExclude = exclude;
    easyRoute = { match, tempo, exclude };
    for (let proxy of proxies) {
        let menu = document.createElement('option');
        menu.textContent = menu.value = proxy;
        proxyMenu.append(menu);
    }
    modeMenu.value = easyMode = mode;
    proxyMenu.value = easyPreset = preset || proxies[0];
    purgeBtn.disabled = Object.keys(tempo).length === 0;
    for (let r of rules) {
        ruleItem(r, 'wildcard');
    }
    for (let h of hosts) {
        ruleItem(h, 'fullhost');
    }
    for (let e of error) {
        easyRules.get(e).classList.add('error');
    }
}

const popupPort = chrome.runtime.connect({ name: 'popup' });
const popupDispatch = {
    'proxy_init': proxyInit,
    'proxy_sync': ({ host, rule }) => {
        manager.classList.remove('asleep');
        ruleItem(rule, 'wildcard');
        ruleItem(host, 'fullhost');
    },
    'proxy_error': ({ host, rule }) => {
        easyRules.get(rule)?.classList?.add('error');
        easyRules.get(host)?.classList?.add('error');
    },
    'proxy_match': (host) => {
        easyMatch[host] = easyPreset;
        easyRules.get(host)?.classList?.add('match');
    },
    'proxy_tempo': (host) => {
        easyTempo[host] = easyPreset;
        easyRules.get(host)?.classList?.add('tempo');
    }
};
popupPort.onMessage.addListener(({ action, params}) => {
    popupDispatch[action]?.(params);
});

chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
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
    rule = hostLET.cloneNode(true);
    let [item, check] = rule.children;
    rule.check = check;
    rule.classList.add(type);
    item.textContent = check.name = value;
    easyRules.set(value, rule);
    return rule;
}

function ruleItem(value, type) {
    let rule = easyRules.get(value) ?? ruleCreate(value, type);
    let { check } = rule;
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
