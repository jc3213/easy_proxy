let easyProfile = {};
let easyProxy = {};

let extension = document.body.classList;
let [menuPane, profilePane, optionsPane,, managePane, template] = document.body.children;
let [newBtn, optionsBtn, saveBtn, importBtn, exportBtn, importEntry, exporter] = menuPane.children;
let [schemeEntry, hostEntry, portEntry, submitBtn] = profilePane.children;
let [proxyMenu, modeMenu, automateMenu, networkMenu, persistMenu] = optionsPane.querySelectorAll('[id]');
let [profileLET, matchLET] = template.children;

document.querySelectorAll('[i18n]').forEach((node) => {
    node.textContent = chrome.i18n.getMessage(node.getAttribute('i18n'));
});

document.querySelectorAll('[i18n-tips]').forEach((node) => {
    node.title = chrome.i18n.getMessage(node.getAttribute('i18n-tips'));
});

function shortcutHandler(event, ctrlKey, button) {
    if (ctrlKey) {
        event.preventDefault();
        button.click();
    }
}

document.addEventListener('keydown', (event) => {
    let {key, ctrlKey} = event;
    switch (key) {
        case 's':
            shortcutHandler(event, ctrlKey, saveBtn);
            break;
        case 'e':
            shortcutHandler(event, ctrlKey, newBtn);
            break;
        case 'q':
            shortcutHandler(event, ctrlKey, optionsBtn);
            break;
    };
});

function menuEventNewProf() {
    extension.remove('set_options');
    extension.toggle('new_profile');
}

function menuEventAdvance() {
    extension.remove('new_profile');
    extension.toggle('set_options');
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

menuPane.addEventListener('click', (event) => {
    switch (event.target.getAttribute('i18n')) {
        case 'options_profile':
            menuEventNewProf();
            break;
        case 'options_advance':
            menuEventAdvance();
            break;
        case 'options_save':
            menuEventSave();
            break;
        case 'options_export':
            menuEventExport();
            break;
    };
});

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
    extension.remove('new_profile');
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

optionsPane.addEventListener('change', (event) => {
    let {id, value, checked} = event.target;
    switch (id) {
        case 'proxy-mode':
            easyStorage.mode = value;
            extension.remove('autopac', 'direct', 'global');
            extension.add(value);
            break;
        case 'proxy-preset':
            easyStorage.preset = value;
            break;
        case 'automate':
            easyStorage.automate = checked;
            break;
        case 'network':
            easyStorage.network = checked;
            break;
        case 'persistent':
            easyStorage.persistent = checked;
            break;
    };
    saveBtn.disabled = false;
});

chrome.runtime.sendMessage({action: 'storage_query'}, ({storage, manifest}) => {
    easyStorage = storage;
    easyStorage.proxies.forEach(createMatchProfile);
    modeMenu.value = storage.mode;
    proxyMenu.value = storage.preset ?? storage.proxies[0];
    networkMenu.checked = storage.network;
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
    let result = entry.value.match(/[^\s\r\n+=,;"'`\\|/?!@#$%^&()\[\]{}<>]+/g);
    if (result) {
        saveBtn.disabled = false;
        let storage = easyStorage[id];
        result.forEach((value) => {
            if (value && !storage.includes(value)) {
                createMatchPattern(list, id, value);
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

function createMatchProfile(id) {
    let profile = profileLET.cloneNode(true);
    let [proxy,, entry,,,, list] = profile.children;
    let server = document.createElement('option');
    proxy.textContent = server.value = server.textContent = id;
    profile.addEventListener('click', (event) => {
        switch (event.target.getAttribute('i18n-tips')) {
            case 'profile_export':
                profileExport(id);
                break;
            case 'profile_resort':
                profileResort(id, list);
                break;
            case 'profile_remove':
                profileRemove(id);
                break;
            case 'match_add':
                matchAddNew(id, list, entry);
                break;
            case 'match_remove':
                matchRemove(id, event.target.parentNode);
                break;
        };
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
