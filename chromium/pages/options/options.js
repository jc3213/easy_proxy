let easyProfile = {};
let easyHandler;

let [menuPane, optionsPane, managePane, excludePane, template] = document.body.children;
let [schemeEntry, proxyEntry, submitBtn, saveBtn, importBtn, exportBtn, importEntry, exportFile] = menuPane.children;
let [excludeTitle, excludeEntry, excludeAdd, excludeResort, excludeList] = excludePane.children;
let [proxyMenu, modeMenu, networkMenu, actionMenu, actionBtn, actionPane] = optionsPane.querySelectorAll('[id]');
let [profileLET, matchLET] = template.children;

function menuSubmit() {
    let id = schemeEntry.value + ' ' + proxyEntry.value ;
    if (easyStorage[id] || !/^(HTTPS?|SOCKS5?) ([^.]+\.)+[^.:]*:\d+$/.test(id)) {
        return;
    }
    easyStorage[id] = [];
    easyStorage.proxies.push(id);
    createMatchProfile(id);
    schemeEntry.value = 'HTTP';
    proxyEntry.value = '';
    saveBtn.disabled = false;
}

function menuSave() {
    saveBtn.disabled = true;
    chrome.runtime.sendMessage({ action: 'options_storage', params: easyStorage });
}

function fileSaver(data, filename, filetype) {
    let blob = new Blob([data]);
    exportFile.href = URL.createObjectURL(blob);
    exportFile.download = filename + '-' + new Date().toLocaleString('ja').replace(/[/: ]/g, '_') + filetype;
    exportFile.click();
}

const menuEvents = {
    'common_submit': menuSubmit,
    'options_save': menuSave,
    'options_import': () => importEntry.click(),
    'options_export': () => fileSaver(JSON.stringify(easyStorage, null, 4), 'easy_proxy', '.json')
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
        managePane.innerHTML = excludeList.innerHTML = importEntry.value = '';
        saveBtn.disabled = true;
        proxyMenu.innerHTML = '';
        actionPane.classList.replace(easyStorage.action, params.action);
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
    let { id, value } = event.target;
    easyStorage[id] = value;
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

function storageDispatch(json) {
    easyStorage = json;
    easyHandler = new Set(json.handler);
    for (let proxy of json.proxies) {
        createMatchProfile(proxy);
    }
    for (let value of json.exclude) {
        createMatchPattern(excludeList, value);
    }
    document.body.className = modeMenu.value = json.mode;
    proxyMenu.value = json.preset ?? json.proxies[0];
    actionMenu.value = json.action;
    networkMenu.checked = json.network;
    for (let item of actionPane.children) {
        let value = item.classList[0];
        if (easyHandler.has(value)) {
            item.classList.add('checked');
        } else {
            item.classList.remove('checked');
        }
    }
}

chrome.runtime.sendMessage({ action: 'options_runtime' }, (storage) => {
    storageDispatch(storage);
    actionPane.classList.add(storage.action);
});

function profileExport(id) {
    chrome.runtime.sendMessage({ action: 'options_script', params: id }, (pac_script) => {
        fileSaver(pac_script, id.replace(/[: ]/g, '_'), '.pac');
    });
}

function matchResort(id, matches) {
    saveBtn.disabled = false;
    easyStorage[id].sort();
    let resort = [...matches.children].sort((a, b) => a.title.localeCompare(b.title));
    matches.append(...resort);
}

function profileRemove(id) {
    saveBtn.disabled = false;
    let { profile, server } = easyProfile[id];
    let { proxies, preset } = easyStorage;
    proxies.splice(proxies.indexOf(id), 1);
    delete easyStorage[id];
    profile.remove();
    server.remove();
    if (proxies.length === 0) {
        proxyMenu.value = easyStorage.preset = null;
    } else if (id === preset) {
        proxyMenu.value = easyStorage.preset = proxies[0];
    }
}

function matchAdd(id, matches, entry) {
    let value = entry.value.match(/^(?:https?:\/\/|\/\/)?(\*|(?:[a-zA-Z0-9-]+\.)*[a-zA-Z0-9]+)(?=\/|$)/)?.[1];
    entry.value = '';
    if (!value) {
        return;
    }
    let storage = easyStorage[id];
    if (storage.includes(value)) {
        return;
    }
    createMatchPattern(matches, value);
    storage.push(value);
    matches.scrollTop = matches.scrollHeight;
    saveBtn.disabled = false;
}

function matchRemove(id, rule) {
    let value = rule.title;
    let profile = easyStorage[id];
    rule.remove();
    profile.splice(profile.indexOf(value), 1);
    saveBtn.disabled = false;
}

const profileEvents = {
    'profile_export': profileExport,
    'profile_remove': profileRemove,
    'match_add': matchAdd,
    'match_resort': matchResort,
    'match_remove': (id, $, _, event) => matchRemove(id, event.target.parentNode)
};

function createMatchProfile(id) {
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
    for (let value of easyStorage[id]) {
        createMatchPattern(matches, value);
    }
    easyProfile[id] = { profile, server, matches };
    proxyMenu.appendChild(server);
    managePane.appendChild(profile);
}

function createMatchPattern(matches, value) {
    let match = matchLET.cloneNode(true);
    let name = match.firstElementChild;
    name.textContent = match.title = value;
    matches.appendChild(match);
}
