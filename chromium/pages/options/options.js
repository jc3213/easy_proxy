let easyStorage = {};
let easyProfile = {};
let easyHandler;
let easyEditor;
let easyRegExp = /^(HTTPS?|SOCKS5?) ([^.]+\.)+[^.:]*:\d+$/;

let mainTree = document.body.children;
let menuPane = mainTree[0];
let optionsPane = mainTree[1];
let editorPane = mainTree[2];
let profilePane = mainTree[3];
let excludePane = mainTree[4];
let template = mainTree[5];

let menuTree = menuPane.children;
let schemeEntry = menuTree[0];
let proxyEntry = menuTree[1];
let submitBtn = menuTree[2];
let saveBtn = menuTree[3];
let importBtn = menuTree[4];
let exportBtn = menuTree[5];
let importEntry = menuTree[6];
let exportFile = menuTree[7];

let optionEntries = optionsPane.querySelectorAll('[id]');
let proxyMenu = optionEntries[0];
let modeMenu = optionEntries[1];
let networkMenu = optionEntries[2];
let actionMenu = optionEntries[3];
let actionBtn = optionEntries[4];
let actionPane = optionEntries[5];
let reloadMenu = optionEntries[6];
let editorBtn = optionEntries[7];

let excludeTree = excludePane.children;
let excludeTitle = excludeTree[0];
let excludeEntry = excludeTree[1];
let excludeAdd = excludeTree[2];
let excludeResort = excludeTree[3];
let excludeList = excludeTree[4];

let templateTree = template.children;
let profileLET = templateTree[0];
let matchLET = templateTree[1];

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

function fileExport(data, filename, filetype) {
    let blob = new Blob([data]);
    exportFile.href = URL.createObjectURL(blob);
    exportFile.download = filename + '-' + new Date().toLocaleString('ja').replace(/[/: ]/g, '_') + filetype;
    exportFile.click();
}

menuPane.addEventListener('click', (event) => {
    let menu = event.target.getAttribute('i18n');

    if (!menu) {
        return;
    }

    if (menu === 'common_submit') {
        menuSubmit();
        return;
    }

    if (menu === 'options_save') {
        saveBtn.disabled = true;
        chrome.runtime.sendMessage({ action: 'options_storage', params: easyStorage });
        return;
    }

    if (menu === 'options_import') {
        importEntry.click();
        return;
    }

    if (menu === 'options_export') {
        fileExport(JSON.stringify(easyStorage, null, 4), 'easy_proxy', '.json');
        return;
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
        importEntry.value = '';
        proxyMenu.innerHTML = '';
        profilePane.innerHTML = '';
        excludeList.innerHTML = '';
        saveBtn.disabled = true;

        let params = JSON.parse(reader.result);
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
    easyStorage.handler = Array.from(easyHandler);
});

let openEditor = false;

editorBtn.addEventListener('click', (event) => {
    editorBtn.classList.toggle('checked');
    editorPane.classList.toggle('hidden');

    if (openEditor) {
        return;
    }

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

    openEditor = true;
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
        let rules = Array.from(updated[id]);
        easyStorage[id] = rules;
        createProfiles(id, rules);
    }

    for (let ex of exclude) {
        createRules(excludeList, ex);
    }

    easyStorage.proxies = Array.from(proxies);
    easyStorage.exclude = Array.from(exclude);

    if (!proxies.has(easyStorage.preset)) {
        let preset = easyStorage.proxies[0];
        proxyMenu.value = preset;
        easyStorage.preset = preset;
    }

    editorPane.style.height = editorHeight();
    saveBtn.disabled = false;
});

excludeEntry.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        matchAdd('exclude', excludeList, excludeEntry);
    }
});

excludePane.addEventListener('click', (event) => {
    let menu = event.target.getAttribute('i18n-tips');

    if (!menu) {
        return;
    }

    if (menu === 'match_add') {
        matchAdd('exclude', excludeList, excludeEntry);
        return;
    }

    if (menu === 'match_resort') {
        matchResort('exclude', excludeList);
        return;
    }

    if (menu === 'match_remove') {
        matchRemove('exclude', event.target.parentNode);
        return;
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
    let mode = json.mode;
    easyStorage = json;
    easyHandler = new Set(json.handler);
    networkMenu.checked = json.network;
    actionMenu.value = json.action;
    reloadMenu.value = json.reload;
    modeMenu.value = mode;
    document.body.className = mode;

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
    entry.value = '';

    if (!match) {
        return;
    }

    let value = match[1];
    let rules = easyStorage[id];

    if (rules.includes(value)) {
        return;
    }

    let rule = createRules(matches, value);
    matches.scrollTop = rule.offsetTop;
    rules.push(value);
    openEditor = false;
    saveBtn.disabled = false;
}

function matchResort(id, matches) {
    let resort = Array.from(matches.children).sort((a, b) => a.title.localeCompare(b.title));
    easyStorage[id].sort();

    matches.append(...resort);
    matches.scrollTop = matches.top;

    saveBtn.disabled = false;
    openEditor = false;
}

function matchRemove(id, rule) {
    let value = rule.title;
    let rules = easyStorage[id];

    rules.splice(rules.indexOf(value), 1);
    rule.remove();

    saveBtn.disabled = false;
    openEditor = false;
}

function createProfiles(id, values) {
    let profile = profileLET.cloneNode(true);
    let server = document.createElement('option');
    let tree = profile.children;
    let proxy = tree[0];
    let entry = tree[2];
    let matches = tree[6];

    proxy.textContent = id;
    server.value = id;
    server.textContent = id;

    profile.addEventListener('click', (event) => {
        let menu = event.target.getAttribute('i18n-tips');

        if (!menu) {
            return;
        }

        if (menu === 'match_add') {
            matchAdd(id, matches, entry);
            return;
        }

        if (menu === 'match_resort') {
            matchResort(id, matches);
            return;
        }

        if (menu === 'match_remove') {
            matchRemove(id, event.target.parentNode);
            return;
        }

        if (menu === 'profile_remove') {
            profileRemove(id);
            return;
        }

        if (menu === 'profile_export') {
            chrome.runtime.sendMessage({ action: 'options_script', params: id }, (pacScript) => {
                fileExport(pacScript, id.replace(/[: ]/g, '_'), '.pac');
            });
            return;
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
