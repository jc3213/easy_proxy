let easyProfile = {};
let easyHandler;

let extension = document.body.classList;
let [menuPane, optionsPane,, managePane, excludePane, template] = document.body.children;
let [schemeEntry, proxyEntry, submitBtn, optionsBtn, saveBtn, importBtn, exportBtn, importEntry, exporter] = menuPane.children;
let [, excludeEntry, excludeAdd, excludeResort, excludeList] = excludePane.children;
let [proxyMenu, modeMenu, actionMenu, actionPane, networkMenu, persistMenu] = optionsPane.querySelectorAll('[id]');
let [profileLET, matchLET] = template.children;

document.querySelectorAll('[i18n]').forEach((node) => {
    node.textContent = chrome.i18n.getMessage(node.getAttribute('i18n'));
});

document.querySelectorAll('[i18n-tips]').forEach((node) => {
    node.title = chrome.i18n.getMessage(node.getAttribute('i18n-tips'));
});

const shortcutMap = {
    's': saveBtn,
    'q': optionsBtn
};

document.addEventListener('keydown', (event) => {
    let key = shortcutMap[event.key];
    if (key && event.ctrlKey) {
        event.preventDefault();
        key.click();
    }
});

function menuEventSubmit() {
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

function menuEventOptions() {
    optionsBtn.classList.toggle('checked');
    optionsPane.classList.toggle('hidden');
}

function menuEventSave() {
    saveBtn.disabled = true;
    chrome.runtime.sendMessage({ action: 'storage_update', params: easyStorage });
}

function menuEventExport() {
    fileSaver(JSON.stringify(easyStorage, null, 4), 'easy_proxy', '.json');
}

function fileSaver(data, filename, filetype) {
    let blob = new Blob([data]);
    exporter.href = URL.createObjectURL(blob);
    exporter.download = filename + '-' + new Date().toLocaleString('ja').replace(/[/: ]/g, '_') + filetype;
    exporter.click();
}

const menuEventMap = {
    'common_submit': menuEventSubmit,
    'options_advance': menuEventOptions,
    'options_save': menuEventSave,
    'options_export': menuEventExport
};

menuPane.addEventListener('click', (event) => {
    let menu = event.target.getAttribute('i18n');
    menuEventMap[menu]?.();
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
        actionPane.classList.replace(easyStorage.action, params.action);
        storageHandler(params);
        chrome.runtime.sendMessage({ action: 'storage_update', params });
    };
    reader.readAsText(event.target.files[0]);
});

const optionHandlers = {
    'proxy-mode': ({ value }) => {
        extension.replace(easyStorage.mode, value);
        easyStorage.mode = value;
    },
    'preset': ({ value }) => {
        easyStorage.preset = value;
    },
    'action': ({ value }) => {
        actionPane.classList.replace(easyStorage.action, value);
        easyStorage.action = value;
    },
    'network': ({ checked }) => {
        easyStorage.network = checked;
    }
};

optionsPane.addEventListener('change', (event) => {
    let entry = event.target;
    optionHandlers[entry.id]?.(entry);
    saveBtn.disabled = false;
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
        matchAddNew('exclude', excludeList, excludeEntry);
    }
});

const excludeEventMap = {
    'match_add': matchAddNew,
    'match_resort': profileResort,
    'match_remove': (id, $, _, event) => matchRemove(id, event.target.parentNode)
};

excludePane.addEventListener('click', (event) => {
    let menu = event.target.getAttribute('i18n-tips');
    excludeEventMap[menu]?.('exclude', excludeList, excludeEntry, event);
});

function storageDispatch(json) {
    easyStorage = json;
    easyHandler = new Set(json.handler);
    json.proxies.forEach(createMatchProfile);
    json.exclude.forEach((value) => createMatchPattern(excludeList, value));
    modeMenu.value = json.mode;
    extension.add(json.mode);
    proxyMenu.value = json.preset ?? json.proxies[0];
    actionMenu.value = json.action;
    networkMenu.checked = json.network;
    [...actionPane.children].forEach((item) => {
        let value = item.classList[0];
        if (easyHandler.has(value)) {
            item.classList.add('checked');
        }
    });
}

chrome.runtime.sendMessage({ action: 'storage_query' }, (storage) => {
    storageDispatch(storage);
    actionPane.classList.add(storage.action);
});

function profileExport(id) {
    chrome.runtime.sendMessage({ action: 'pacscript_query', params: id }, (pac_script) => {
        fileSaver(pac_script, id.replace(/[: ]/g, '_'), '.pac');
    });
}

function profileResort(id, list) {
    saveBtn.disabled = false;
    easyStorage[id].sort();
    let resort = [...list.children].sort((a, b) => a.title.localeCompare(b.title));
    list.append(...resort);
}

function profileRemove(id) {
    saveBtn.disabled = false;
    let { profile, server } = easyProfile[id];
    let { proxies } = easyStorage;
    proxies.splice(proxies.indexOf(id), 1);
    delete easyStorage[id];
    profile.remove();
    server.remove();
    if (!proxies.includes(easyStorage.preset)) {
        proxyMenu.value = easyStorage.preset = null;
    }
}

function matchAddNew(id, list, entry) {
    let storage = easyStorage[id];
    let value = entry.value.match(/^(\*|[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*)$/)?.[0];
    if (value && !storage.includes(value)) {
        saveBtn.disabled = false;
        createMatchPattern(list, value);
        storage.push(value);
        list.scrollTop = list.scrollHeight;
    }
    entry.value = '';
}

function matchRemove(id, rule) {
    saveBtn.disabled = false;
    let value = rule.title;
    let profile = easyStorage[id];
    rule.remove();
    profile.splice(profile.indexOf(value), 1);
}

const profileEventMap = {
    'profile_export': profileExport,
    'profile_remove': profileRemove,
    'match_add': matchAddNew,
    'match_resort': profileResort,
    'match_remove': (id, $, _, event) => matchRemove(id, event.target.parentNode)
};

function createMatchProfile(id) {
    let profile = profileLET.cloneNode(true);
    let [proxy,, entry,,,, list] = profile.children;
    let server = document.createElement('option');
    proxy.textContent = server.value = server.textContent = id;
    profile.addEventListener('click', (event) => {
        let menu = event.target.getAttribute('i18n-tips');
        profileEventMap[menu]?.(id, list, entry, event);
    });
    entry.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            matchAddNew(id, list, entry);
        }
    });
    easyStorage[id].forEach((value) => createMatchPattern(list, value));
    easyProfile[id] = { profile, server };
    proxyMenu.appendChild(server);
    managePane.appendChild(profile);
}

function createMatchPattern(list, value) {
    let match = matchLET.cloneNode(true);
    let name = match.children[0];
    name.textContent = match.title = value;
    list.appendChild(match);
}
