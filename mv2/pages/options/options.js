let easyProfile = {};
let easyProxy = {};
let easyModes = ['direct', 'autopac', 'global'];

let extension = document.body.classList;
let [menuPane, profilePane, optionsPane,, managePane, template] = document.body.children;
let [newBtn, optionsBtn, saveBtn, importBtn, exportBtn, importEntry, exporter] = menuPane.children;
let [schemeEntry, hostEntry, portEntry, submitBtn] = profilePane.children;
let [modeMenu, proxyMenu, indicatorMenu, persistMenu] = optionsPane.querySelectorAll('[id]');
let [profileLET, matchLET] = template.children;

document.querySelectorAll('[i18n]').forEach((node) => {
    node.textContent = chrome.i18n.getMessage(node.getAttribute('i18n'));
});

document.querySelectorAll('[i18n-tips]').forEach((node) => {
    node.title = chrome.i18n.getMessage(node.getAttribute('i18n-tips'));
});

const shortcutHandlers = {
    's': saveBtn,
    'f': newBtn,
    'q': optionsBtn
};

document.addEventListener('keydown', (event) => {
    let handler = shortcutHandlers[event.key];
    if (event.ctrlKey && handler) {
        event.preventDefault();
        handler.click();
    }
});

newBtn.addEventListener('click', (event) => {
    extension.remove('set_options');
    extension.toggle('new_profile');
});

optionsBtn.addEventListener('click', (event) => {
    extension.remove('new_profile');
    extension.toggle('set_options');
});

saveBtn.addEventListener('click', (event) => {
    saveBtn.disabled = true;
    chrome.runtime.sendMessage({action: 'storage_update', params: easyStorage});
});

exportBtn.addEventListener('click', (event) => {
    fileSaver(JSON.stringify(easyStorage, null, 4), 'json', 'easy_proxy', '.json');
});

function fileSaver(data, type, filename, filetype) {
    let blob = new Blob([data], {type: 'application/' + type + ';charset=utf-8;'});
    exporter.href = URL.createObjectURL(blob);
    exporter.download = filename + '-' + new Date().toLocaleString('ja').replace(/[\/\s:]/g, '_') + filetype;
    exporter.click();
}

submitBtn.addEventListener('click', (event) => {
    let profile = schemeEntry.value + ' ' + hostEntry.value + ':' + portEntry.value;
    if (!hostEntry.value || !portEntry.value || easyStorage[profile]) {
        return;
    }
    easyStorage[profile] = [];
    easyStorage.proxies.push(profile);
    createMatchProfile(profile);
    schemeEntry.value = 'HTTP';
    hostEntry.value = portEntry.value = '';
    document.body.classList.remove('new_profile');
    saveBtn.disabled = false;
});

importEntry.addEventListener('change', (event) => {
    let reader = new FileReader();
    reader.onload = (event) => {
        let params = JSON.parse(reader.result);
        managePane.innerHTML = '';
        easyStorage = params;
        easyStorage.proxies.forEach(createMatchProfile);
        event.target.value = '';
        saveBtn.disabled = true;
        chrome.runtime.sendMessage({action: 'storage_update', params});
    };
    reader.readAsText(event.target.files[0]);
});

profilePane.addEventListener('keydown', (event) => {
    if (event.target.localName === 'input' && event.key === 'Enter') {
        submitBtn.click();
    }
});

modeMenu.addEventListener('change', (event) => {
    let mode = event.target.value;
    let hide = easyModes.filter((key) => key !== mode);
    extension.add(...mode);
    extension.remove(...hide);
    easyStorage.direct = mode === 'global' ? proxyMenu.value : mode;
    saveBtn.disabled = false;
});

proxyMenu.addEventListener('change', (event) => {
    easyStorage.direct = proxyMenu.value;
    saveBtn.disabled = false;
});

indicatorMenu.addEventListener('change', (event) => {
    easyStorage.indicator = event.target.checked;
    saveBtn.disabled = false;
});

persistMenu.addEventListener('change', (event) => {
    easyStorage.persistent = event.target.checked;
    saveBtn.disabled = false;
});

chrome.runtime.sendMessage({action: 'storage_query'}, ({storage, manifest}) => {
    let mode = storage.direct;
    easyStorage = storage;
    easyStorage.proxies.forEach(createMatchProfile);
    switch (mode) {
        case 'direct':
        case 'autopac':
            modeMenu.value = mode;
            extension.add(mode);
            break;
        default:
            modeMenu.value = 'global';
            proxyMenu.value = mode;
            extension.add('global');
            break;
    }
    indicatorMenu.checked = easyStorage.indicator;
    if (manifest === 3) {
        persistMenu.checked = easyStorage.persistent;
    } else {
        persistMenu.parentNode.remove();
    }
});

const profileHandlers = {
    'profile_export': profileExport,
    'profile_resort': profileResort,
    'profile_remove': profileRemove,
    'match_add': matchAddNew,
    'match_remove': matchRemove
};

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
    saveBtn.disabled = false;
    let storage = easyStorage[id];
    entry.value.match(/[^\s\r\n+=,;"'`\\|/?!@#$%^&()\[\]{}<>]+/g)?.forEach((value) => {
        if (value && !storage.includes(value)) {
            createMatchPattern(list, id, value);
            storage.push(value);
        }
    });
    entry.value = '';
    list.scrollTop = list.scrollHeight;
}

function matchRemove(id, list, entry, event) {
    saveBtn.disabled = false;
    let match = event.target.parentNode;
    let value = match.title;
    match.remove();
    easyStorage[id].splice(easyStorage[id].indexOf(value), 1);
}

function createMatchProfile(id) {
    let profile = profileLET.cloneNode(true);
    let [proxy,, entry,,,, list] = profile.children;
    let server = document.createElement('option');
    proxy.textContent = server.value = server.textContent = id;
    profile.addEventListener('click', (event) => {
        let handler = profileHandlers[event.target.getAttribute('i18n-tips')];
        if (handler) {
            handler(id, list, entry, event);
        }
    });
    entry.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            matchAddNew(id, list, entry);
        }
    });
    easyStorage[id].forEach((value) => createMatchPattern(list, id, value));
    easyProfile[id] = profile;
    proxyMenu.appendChild(server);
    managePane.appendChild(profile);
}

function createMatchPattern(list, id, value) {
    let match = matchLET.cloneNode(true);
    let name = match.children[0];
    name.textContent = match.title = value;
    list.appendChild(match);
}
