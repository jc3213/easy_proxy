let easyProfile = {};
let easyProxy = {};
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
    let profile = schemeEntry.value + ' ' + proxyEntry.value ;
    if (easyStorage[profile] || !/^(HTTPS?|SOCKS5?) ([^.]+\.)+[^.:]*:\d+$/.test(profile)) {
        return;
    }
    easyStorage[profile] = [];
    easyStorage.proxies.push(profile);
    createMatchProfile(profile);
    schemeEntry.value = 'HTTP';
    proxyEntry.value = '';
    extension.remove('new_profile');
    saveBtn.disabled = false;
}

function menuEventOptions() {
    extension.toggle('set_options');
    optionsBtn.classList.toggle('checked');
}

function menuEventSave() {
    saveBtn.disabled = true;
    chrome.runtime.sendMessage({action: 'storage_update', params: easyStorage});
}

function menuEventExport() {
    fileSaver(JSON.stringify(easyStorage, null, 4), 'json', 'easy_proxy', '.json');
}

function fileSaver(data, type, filename, filetype) {
    let blob = new Blob([data], {type: 'application/' + type + ';charset=utf-8;'});
    exporter.href = URL.createObjectURL(blob);
    exporter.download = filename + '-' + new Date().toLocaleString('ja').replace(/[\/\s:]/g, '_') + filetype;
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
        managePane.innerHTML = excludeList.innerHTML = '';
        saveBtn.disabled = true;
        storageHandler(params);
        chrome.runtime.sendMessage({action: 'storage_update', params});
        importEntry.value = '';
    };
    reader.readAsText(event.target.files[0]);
});

const optionsChangeMap = {
    'proxy-mode': ({ value }) => {
        easyStorage.mode = value;
        extension.remove('autopac', 'direct', 'global');
        extension.add(value);
    },
    'preset': ({ value }) => {
        easyStorage.preset = value;
    },
    'action': ({ value }) => {
        easyStorage.action = value;
        actionPane.style.display = value === 'none' ? '' : 'block';
    },
    'network': ({ checked }) => {
        easyStorage.network = checked;
    },
    'persistent': ({ checked }) => {
        easyStorage.persistent = checked;
    }
};

optionsPane.addEventListener('change', (event) => {
    let entry = event.target;
    optionsChangeMap[entry.id]?.(entry);
    saveBtn.disabled = false;
});

actionPane.addEventListener('click', (event) => {
    let click = event.target;
    let value = click.classList[0];
    if (easyHandler.has(value)) {
        easyHandler.delete(value);
    } else {
        easyHandler.add(value);
    }
    click.classList.toggle('checked');
    easyStorage.handler = [...easyHandler];
    saveBtn.disabled = false;
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

function storageHandler(json) {
    easyStorage = json;
    easyHandler = new Set(json.handler);
    json.proxies.forEach(createMatchProfile);
    json.exclude.forEach((value) => createMatchPattern(excludeList, value));
    modeMenu.value = json.mode;
    extension.add(json.mode);
    proxyMenu.value = json.preset ?? json.proxies[0];
    actionMenu.value = json.action;
    networkMenu.checked = json.network;
    actionPane.style.display = json.action === 'none' ? '' : 'block';
    [...actionPane.children].forEach((item) => {
        let value = item.classList[0];
        if (easyHandler.has(value)) {
            item.classList.add('checked');
        }
    });
}

chrome.runtime.sendMessage({action: 'storage_query'}, ({storage, manifest}) => {
    storageHandler(storage);
    if (manifest === 3) {
        persistMenu.checked = storage.persistent;
    } else {
        persistMenu.parentNode.remove();
    }
});

function profileExport(id) {
    chrome.runtime.sendMessage({action: 'pacscript_query', params: id}, (pac_script) => {
        fileSaver(pac_script, 'x-ns-proxy-autoconfig;', id.replace(/[\s:]/g, '_'), '.pac');
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
    easyProfile[id].remove();
    easyStorage.proxies.splice(easyStorage.proxies.indexOf(id), 1);
    delete easyStorage[id];
}

function matchAddNew(id, list, entry) {
    let result = entry.value.match(/[^ :.,]+\.+[^ ;.,]+/g);
    if (result) {
        saveBtn.disabled = false;
        let storage = easyStorage[id];
        result.forEach((value) => {
            if (value && !storage.includes(value)) {
                createMatchPattern(list, value);
                storage.push(value);
            }
        });
        entry.value = '';
        list.scrollTop = list.scrollHeight;
    }
}

function matchRemove(id, rule) {
    saveBtn.disabled = false;
    let value = rule.title;
    rule.remove();
    easyStorage[id].splice(easyStorage[id].indexOf(value), 1);
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
    easyProfile[id] = profile;
    proxyMenu.appendChild(server);
    managePane.appendChild(profile);
}

function createMatchPattern(list, value) {
    let match = matchLET.cloneNode(true);
    let name = match.children[0];
    name.textContent = match.title = value;
    list.appendChild(match);
}
