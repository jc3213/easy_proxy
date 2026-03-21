let easyRules = new Map();
let easyTypes = new Set();
let easyChanges = new Set();
let easyMatch;
let easyTempo;
let easyExclude;
let easyRoute;
let easyMode;
let easyProxy;
let easyTab;
let easyUrl

let manager = document.body;
let [rulesPane, extraPane,, menuPane, template] = manager.children;
let [proxyMenu, switchBtn, defaultBtn] = extraPane.children;
let [modeMenu, purgeBtn, submitBtn, tempoBtn, optionsBtn] = menuPane.children;
let hostLET = template.children[0];

function proxyUpdate(type) {
    if (type.props !== type.value) {
        easyChanges.add(type);
    } else {
        easyChanges.delete(type);
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
    easyProxy = event.target.value;
});

modeMenu.addEventListener('change', (event) => {
    let mode = modeMenu.value;
    chrome.runtime.sendMessage({ action: 'popup_mode', params: { mode, referer: easyUrl } }, () => {
        manager.className = easyMode = mode;
    });
});

function menuEventSubmit() {
    let changes = [];
    for (let type of easyChanges) {
        let { name, value, props, title, parentNode } = type;
        if (props !== 'direct') {
            delete easyRoute[props][name];
            changes.push({ action: 'remove', type: props, proxy: title, rule: name });
        }
        if (value !== 'direct') {
            easyRoute[value][name] = easyProxy;
            changes.push({ action: 'add', type: value, proxy: easyProxy, rule: name });
            type.title = value === 'exclude' ? '' : easyProxy;
        }
        parentNode.classList.remove(props, 'error');
        parentNode.classList.add(value);
        type.props = value;
    }
    purgeBtn.disabled = Object.keys(easyTempo).length === 0;
    chrome.runtime.sendMessage({ action: 'popup_submit', params: { changes, referer: easyUrl } });
}

function menuEventPurge() {
    for (let rule of easyRules.values()) {
        if (rule.classList.contains('tempo')) {
            rule.classList.replace('tempo', 'direct');
            rule.type.value = rule.type.props = 'direct';
        }
    }
    chrome.runtime.sendMessage({ action: 'popup_purge', params: easyUrl });
    easyTempo = {};
    easyTypes = new Set();
    purgeBtn.disabled = true;
}

function extraEventDefault() {
    for (let type of easyChanges) {
        type.value = type.props;
    }
    easyChanges = new Set();
    submitBtn.disabled = defaultBtn.disabled = true;
}

function extraEventSwitch() {
    rulesPane.classList.toggle('switch'); 
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

chrome.webNavigation.onBeforeNavigate.addListener(({ tabId, frameId }) => {
    if (tabId === easyTab && frameId === 0) {
        rulePurge();
    }
});

chrome.tabs.onUpdated.addListener((tabId, { status, url }) => {
    if (tabId !== easyTab) {
        return;
    }
    if (url && url !== easyUrl) {
        easyUrl = url;
        rulePurge();
    }
    if (status) {
        return;
    }
    chrome.runtime.sendMessage({ action: 'popup_update', params: easyTab }, ruleListing);
});

chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    easyTab = tab.id;
    easyUrl = tab.url;
    chrome.runtime.sendMessage({ action: 'popup_runtime', params: easyTab }, ({ proxies, mode, preset, match, tempo, exclude, ...rules}) => {
        manager.className = proxies.length === 0 || rules.length === 0 && hosts.length === 0 ? 'asleep' : mode;
        modeMenu.value = easyMode = mode;
        proxyMenu.value = easyProxy = preset || proxies[0];
        easyMatch = match;
        easyTempo = tempo;
        easyExclude = exclude;
        easyRoute = { match, tempo, exclude };
        for (let proxy of proxies) {
            let menu = document.createElement('option');
            menu.textContent = menu.value = proxy;
            proxyMenu.append(menu);
        }
        purgeBtn.disabled = Object.keys(tempo).length === 0;
        ruleListing(rules);
    });
});

function ruleListing({ hosts, rules, error }) {
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

function rulePurge() {
    easyTypes = new Set();
    easyChanges = new Set();
    rulesPane.innerHTML = '';
    submitBtn.disabled = defaultBtn.disabled = true;
}

function ruleCreate(value, stat) {
    rule = hostLET.cloneNode(true);
    let [item, type] = rule.children;
    rule.type = type;
    rule.classList.add(stat);
    item.textContent = type.name = value;
    easyRules.set(value, rule);
    return rule;
}

function ruleStatus(rule, type, stat, title) {
    rule.classList.add(stat);
    type.value = type.props = stat;
    type.title = title;
}

function ruleItem(value, stat) {
    let rule = easyRules.get(value) ?? ruleCreate(value, stat);
    let { type } = rule;
    if (easyTypes.has(type)) {
        return;
    }
    let match = easyMatch[value];
    let tempo = easyTempo[value];
    if (easyExclude[value]) {
        ruleStatus(rule, type, 'exclude', 'DIRECT');
    } else if (match) {
        ruleStatus(rule, type, 'match', match);
    } else if (tempo) {
        ruleStatus(rule, type, 'tempo', tempo);
    } else {
        ruleStatus(rule, type, 'direct', '');
    }
    easyTypes.add(type);
    rulesPane.append(rule);
}
