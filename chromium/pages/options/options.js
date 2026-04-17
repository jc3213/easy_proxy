let easyStorage = {};
let easyProfile = {};
let easyHandler;
let easyEditor;
let easyRegExp = /^(HTTPS?|SOCKS5?) ([^.]+\.)+[^.:]*:\d+$/;

let [menuPane, optionsPane, editorPane, profilePane, excludePane, template] = document.body.children;
let [schemeEntry, proxyEntry, submitBtn, saveBtn, importBtn, exportBtn, importEntry, exportFile] = menuPane.children;
let [proxyMenu, modeMenu, networkMenu, actionMenu, actionBtn, actionPane, editorBtn] = optionsPane.querySelectorAll('[id]');
let [excludeTitle, excludeEntry, excludeAdd, excludeResort, excludeList] = excludePane.children;
let [profileLET, matchLET] = template.children;

function menuSubmit() {
    let id = schemeEntry.value + ' ' + proxyEntry.value ;
    if (easyStorage[id] || !easyRegExp.test(id)) {
        return;
    }
    easyStorage.proxies.push(id);
    easyStorage[id] = [];
    createProfiles(id);
    schemeEntry.value = 'HTTP';
    proxyEntry.value = '';
    saveBtn.disabled = openEditor = false;
}

function menuSave() {
    saveBtn.disabled = true;
    chrome.runtime.sendMessage({ action: 'options_storage', params: easyStorage });
}

function fileExport(data, filename, filetype) {
    let blob = new Blob([data]);
    exportFile.href = URL.createObjectURL(blob);
    exportFile.download = filename + '-' + new Date().toLocaleString('ja').replace(/[/: ]/g, '_') + filetype;
    exportFile.click();
}

const menuEvents = {
    'common_submit': menuSubmit,
    'options_save': menuSave,
    'options_import': () => importEntry.click(),
    'options_export': () => fileExport(JSON.stringify(easyStorage, null, 4), 'easy_proxy', '.json')
};

menuPane.addEventListener('click', (event) => {
    let menu = event.target.getAttribute('i18n');
    menuEvents[menu]?.();
});

menuPane.addEventListener('keydown', (event) => {
    if (event.target.name === 'proxy' && event.key === 'Enter') {
        submitBtn.click();
    }
});

importEntry.addEventListener('change', (event) => {
    let reader = new FileReader();
    reader.onload = (event) => {
        let params = JSON.parse(reader.result);
        proxyMenu.innerHTML = profilePane.innerHTML = excludeList.innerHTML = importEntry.value = '';
        saveBtn.disabled = true;
        storageDispatch(params);
        chrome.runtime.sendMessage({ action: 'options_storage', params });
    };
    reader.readAsText(event.target.files[0]);
});

const optionEvents = {
    'proxy-mode': (value) => {
        document.body.className = value;
    }
};

optionsPane.addEventListener('change', (event) => {
    let { id, type, value, checked } = event.target;
    easyStorage[id] = type === 'checkbox' ? checked : value;
    optionEvents[id]?.(value);
    saveBtn.disabled = false;
});

actionBtn.addEventListener('click', (event) => {
    actionBtn.classList.toggle('checked');
    actionPane.classList.toggle('hidden');
});

actionPane.addEventListener('click', (event) => {
    saveBtn.disabled = false;
    let error = event.target;
    let value = error.classList[0];
    if (easyHandler.has(value)) {
        easyHandler.delete(value);
    } else {
        easyHandler.add(value);
    }
    error.classList.toggle('checked');
    easyStorage.handler = [...easyHandler];
});

let openEditor = false;

editorBtn.addEventListener('click', (event) => {
    editorBtn.classList.toggle('checked');
    editorPane.classList.toggle('hidden');
    if (openEditor) {
        return;
    }
    openEditor = true;
    let { proxies, exclude } = easyStorage;
    let editor = [];
    for (let proxy of proxies) {
        for (let r of easyStorage[proxy]) {
            editor.push(r + '=' + proxy);
        }
    }
    for (let e of exclude) {
        editor.push(e + '=DIRECT');
    }
    editorPane.value = editor.join('\n');
    editorPane.style.height = editorHeight();
});

editorPane.addEventListener('change', (event) => {
    let proxies = new Set();
    let exclude = new Set();
    let updated = {};
    for (let rule of editorPane.value.split('\n')) {
        if (!rule) {
            continue;
        }
        let [value, proxy] = rule.split('=');
        if (!value || !proxy) {
            continue;
        }
        if (proxy === 'DIRECT') {
            exclude.add(value);
        } else if (easyRegExp.test(proxy)) {
            let rules = updated[proxy] ??= new Set();
            proxies.add(proxy);
            rules.add(value);
        }
    }
    proxyMenu.innerHTML = profilePane.innerHTML = excludeList.innerHTML = '';
    for (let id of proxies) {
        let rules = updated[id];
        easyStorage[id] = [...rules];
        createProfiles(id, rules);
    }
    for (let rule of exclude) {
        createRules(excludeList, rule);
    }
    easyStorage.proxies = [...proxies];
    easyStorage.exclude = [...exclude];
    if (!proxies.has(easyStorage.preset)) {
        proxyMenu.value = easyStorage.preset = easyStorage.proxies[0];
    }
    saveBtn.disabled = false;
});

excludeEntry.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        matchAdd('exclude', excludeList, excludeEntry);
    }
});

const excludeEvents = {
    'match_add': matchAdd,
    'match_resort': matchResort,
    'match_remove': (id, $, _, event) => matchRemove(id, event.target.parentNode)
};

excludePane.addEventListener('click', (event) => {
    let menu = event.target.getAttribute('i18n-tips');
    excludeEvents[menu]?.('exclude', excludeList, excludeEntry, event);
});

excludePane.addEventListener('click', (event) => {
    let menu = event.target.getAttribute('i18n-tips');
    excludeEvents[menu]?.('exclude', event);
});

function editorHeight() {
    let profileTop = profilePane.getBoundingClientRect().top;
    let { top: excludeTop, height: excludeHeight } = excludePane.getBoundingClientRect();
    return excludeTop + excludeHeight - profileTop - 38 + 'px';
}

function storageDispatch(json) {
    easyStorage = json;
    easyHandler = new Set(json.handler);
    actionMenu.value = json.action;
    networkMenu.checked = json.network;
    document.body.className = modeMenu.value = json.mode;
    for (let item of actionPane.children) {
        let value = item.classList[0];
        if (easyHandler.has(value)) {
            item.classList.add('checked');
        } else {
            item.classList.remove('checked');
        }
    }
    for (let proxy of json.proxies) {
        createProfiles(proxy, json[proxy]);
    }
    for (let rule of json.exclude) {
        createRules(excludeList, rule);
    }
    proxyMenu.value = json.preset ?? json.proxies[0];
}

chrome.runtime.sendMessage({ action: 'options_runtime' }, storageDispatch);

function profileExport(id) {
    chrome.runtime.sendMessage({ action: 'options_script', params: id }, (pac_script) => {
        fileExport(pac_script, id.replace(/[: ]/g, '_'), '.pac');
    });
}

function profileRemove(id) {
    let { profile, server } = easyProfile[id];
    let { preset, proxies } = easyStorage;
    if (proxies.length === 0) {
        proxyMenu.value = easyStorage.preset = null;
    } else if (id === preset) {
        proxyMenu.value = easyStorage.preset = easyStorage.proxies[0];
    }
    server.remove();
    profile.remove();
    saveBtn.disabled = openEditor = false;
}

function matchAdd(id, matches, entry) {
    let value = entry.value.match(/^(?:https?:\/\/|\/\/)?(\*|(?:[a-zA-Z0-9-]+\.)*[a-zA-Z0-9]+)(?=\/|$)/)?.[1];
    entry.value = '';
    if (!value) {
        return;
    }
    let rules = id === 'direct' ? easyStorage.exclude : easyStorage[id];
    if (rules.includes(value)) {
        return;
    }
    rules.push(value);
    let rule = createRules(matches, value);
    matches.scrollTop = rule.offsetTop;
    saveBtn.disabled = openEditor = false;
}

function matchResort(id, matches) {
    let resort = [...matches.children].sort((a, b) => a.title.localeCompare(b.title));
    easyStorage[id].sort();
    matches.append(...resort);
    matches.scrollTop = matches.top;
    saveBtn.disabled = openEditor = false;
}

function matchRemove(id, rule) {
    let value = rule.title;
    let rules = easyStorage[id];
    rule.remove();
    rules.splice(rules.indexOf(value), 1);
    saveBtn.disabled = openEditor = false;
}

const profileEvents = {
    'profile_export': profileExport,
    'profile_remove': profileRemove,
    'match_add': matchAdd,
    'match_resort': matchResort,
    'match_remove': (id, $, _, event) => matchRemove(id, event.target.parentNode)
};

function createProfiles(id, values) {
    let profile = profileLET.cloneNode(true);
    let [proxy,, entry,,,, matches] = profile.children;
    let server = document.createElement('option');
    proxy.textContent = server.value = server.textContent = id;
    profile.addEventListener('click', (event) => {
        let menu = event.target.getAttribute('i18n-tips');
        profileEvents[menu]?.(id, matches, entry, event);
    });
    entry.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            matchAdd(id, matches, entry);
        }
    });
    easyProfile[id] = { profile, server, matches, entry };
    proxyMenu.appendChild(server);
    profilePane.appendChild(profile);
    if (!values) {
        return;
    }
    for (let v of values) {
        createRules(matches, v);
    }
}

function createRules(matches, value) {
    let rule = matchLET.cloneNode(true);
    rule.title = rule.firstElementChild.textContent = value;
    matches.appendChild(rule);
    return rule;
}
