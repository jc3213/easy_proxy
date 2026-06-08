let easyStorage = {};
let easyProfile = {};
let easyHandler;
let easyEditor;
let easyRegExp = /^(HTTPS?|SOCKS5?) ([^.]+\.)+[^.:]*:\d+$/;

let [menuPane, optionsPane, editorPane, profilePane, excludePane, template] = document.body.children;
let [schemeEntry, proxyEntry, submitBtn, saveBtn, importBtn, exportBtn, importEntry, exportFile] = menuPane.children;
let [proxyMenu, modeMenu, networkMenu, actionMenu, actionBtn, actionPane, reloadMenu, editorBtn] = optionsPane.querySelectorAll('[id]');
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
    let handler = menuEvents[menu];
    if (handler) {
        handler();
    }
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

optionsPane.addEventListener('change', (event) => {
    let entry = event.target;
    let id = entry.id;
    let value = entry.type === 'checkbox' ? entry.checked : entry.value;
    if (id === 'proxy-mode') {
        document.body.className = value;
    }
    easyStorage[id] = value;
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
    let proxies = easyStorage.proxies;
    let exclude = easyStorage.exclude;
    let editor = [];
    for (let i = 0, l = proxies.length; i < l; i++) {
        let id = proxies[i];
        let rules = easyStorage[id];
        for (let j = 0, m = rules.length; j < m; j++) {
            editor.push(rules[j] + '=' + id);
        }
    }
    for (let i = 0, l = exclude.length; i < l; i++) {
        editor.push(exclude[i] + '=DIRECT');
    }
    editorPane.value = editor.join('\n');
    editorPane.style.height = editorHeight();
});

editorPane.addEventListener('change', (event) => {
    let updated = {};
    let proxies = new Set();
    let exclude = new Set();
    let lines = editorPane.value.split('\n');
    for (let i = 0, l = lines.length; i < l; i++) {
        let rule = lines[i];
        if (!rule) {
            continue;
        }
        let entries = rule.split('=');
        let value = entries[0];
        let proxy = entries[1];
        if (!value || !proxy) {
            continue;
        }
        if (proxy === 'DIRECT') {
            exclude.add(value);
        } else if (easyRegExp.test(proxy)) {
            let rules = updated[proxy];
            if (!rules) {
                rules = new Set();
                proxies.add(proxy);
                updated[proxy] = rules;
            }
            rules.add(value);
        }
    }
    let old_proxies = easyStorage.proxies;
    for (let i = 0, l = old_proxies.length; i < l; i++) {
        let id = old_proxies[i];
        if (!proxies.has(id)) {
            delete easyStorage[id];
        }
    }
    proxyMenu.innerHTML = profilePane.innerHTML = excludeList.innerHTML = '';
    for (let id of proxies) {
        let rules = [...updated[id]];
        easyStorage[id] = rules;
        createProfiles(id, rules);
    }
    for (let ex of exclude) {
        createRules(excludeList, ex);
    }
    easyStorage.proxies = [...proxies];
    easyStorage.exclude = [...exclude];
    if (!proxies.has(easyStorage.preset)) {
        proxyMenu.value = easyStorage.preset = easyStorage.proxies[0];
    }
    editorPane.style.height = editorHeight();
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
    let handler = excludeEvents[menu];
    if (handler) {
        handler('exclude', excludeList, excludeEntry, event);
    }
});

function editorHeight() {
    let profileTop = profilePane.getBoundingClientRect().top;
    let bounding = excludePane.getBoundingClientRect();
    let excludeTop = bounding.top;
    let excludeHeight = bounding.height;
    return excludeTop + excludeHeight - profileTop - 38 + 'px';
}

function storageDispatch(json) {
    easyStorage = json;
    easyHandler = new Set(json.handler);
    networkMenu.checked = json.network;
    actionMenu.value = json.action;
    reloadMenu.value = json.reload;
    document.body.className = modeMenu.value = json.mode;
    let actions = actionPane.children;
    for (let i = 0, l = actions.length; i < l; i++) {
        let action = actions[i];
        let value = action.classList[0];
        if (easyHandler.has(value)) {
            action.classList.add('checked');
        } else {
            action.classList.remove('checked');
        }
    }
    let proxies = json.proxies;
    for (let i = 0, l = proxies.length; i < l; i++) {
        let proxy = proxies[i];
        createProfiles(proxy, json[proxy]);
    }
    let exclude = json.exclude;
    for (let i = 0, l = exclude.length; i < l; i++) {
        createRules(excludeList, exclude[i]);
    }
    proxyMenu.value = json.preset || json.proxies[0];
}

chrome.runtime.sendMessage({ action: 'options_runtime' }, storageDispatch);

function profileExport(id) {
    chrome.runtime.sendMessage({ action: 'options_script', params: id }, (pac_script) => {
        fileExport(pac_script, id.replace(/[: ]/g, '_'), '.pac');
    });
}

function profileRemove(id) {
    let nodes = easyProfile[id];
    let profile = nodes.profile;
    let server = nodes.server;
    let proxies = easyStorage.proxies;
    let preset = easyStorage.preset;
    proxies.splice(proxies.indexOf(id), 1);
    delete easyStorage[id];
    if (proxies.length === 0) {
        proxyMenu.value = easyStorage.preset = null;
    } else if (id === preset) {
        proxyMenu.value = easyStorage.preset = proxies[0];
    }
    server.remove();
    profile.remove();
    saveBtn.disabled = openEditor = false;
}

function matchAdd(id, matches, entry) {
    let match = entry.value.match(/^(?:https?:\/\/|\/\/)?(\*|(?:[a-zA-Z0-9-]+\.)*[a-zA-Z0-9]+)(?=\/|$)/);
    if (!match) {
        return;
    }
    let value = match[1];
    let rules = easyStorage[id];
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
    rules.splice(rules.indexOf(value), 1);
    rule.remove();
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
    let tree = profile.children;
    let proxy = tree[0];
    let entry = tree[2];
    let matches = tree[6];
    let server = document.createElement('option');
    proxy.textContent = server.value = server.textContent = id;
    profile.addEventListener('click', (event) => {
        let menu = event.target.getAttribute('i18n-tips');
        let handler = profileEvents[menu];
        if (handler) {
            handler(id, matches, entry, event);
        }
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
    for (let i = 0, l = values.length; i < l; i++) {
        createRules(matches, values[i]);
    }
}

function createRules(matches, value) {
    let rule = matchLET.cloneNode(true);
    rule.title = rule.firstElementChild.textContent = value;
    matches.appendChild(rule);
    return rule;
}
