let easyProfile = {};
let easyProxy = {};
let easyModes = ['direct', 'autopac', 'global'];

let extension = document.body.classList;
let [newBtn, optionsBtn, saveBtn, importBtn, exportBtn, importEntry, submitBtn] = document.querySelectorAll('#menu > button, #menu > input, #profile > button');
let [exporter, modeMenu, proxyMenu, indicatorMenu, persistMenu, manager] = document.querySelectorAll('a, #options [id], #manager');
let [profileLET, matchLET] = document.querySelectorAll('.template > *');
let [schemeEntry, hostEntry, portEntry] = document.querySelectorAll('#profile > [name]');

document.querySelectorAll('[i18n]').forEach((node) => {
    node.textContent = chrome.i18n.getMessage(node.getAttribute('i18n'));
});

document.querySelectorAll('[i18n-tips]').forEach((node) => {
    node.title = chrome.i18n.getMessage(node.getAttribute('i18n-tips'));
});

const shortcutHandlers = {
    's': saveBtn
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

hostEntry.addEventListener('keydown', newProfileShortcut);
portEntry.addEventListener('keydown', newProfileShortcut);

function newProfileShortcut(event) {
    if (event.key === 'Enter') {
        submitBtn.click();
    }
}

submitBtn.addEventListener('click', (event) => {
    let profile = schemeEntry.value + ' ' + hostEntry.value + ':' + portEntry.value;
    if (easyStorage[profile]) {
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
        manager.innerHTML = '';
        easyStorage = params;
        easyStorage.proxies.forEach(createMatchProfile);
        event.target.value = '';
        saveBtn.disabled = true;
        chrome.runtime.sendMessage({action: 'storage_update', params});
    };
    reader.readAsText(event.target.files[0]);
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
    if (mode === 'direct' || mode === 'autopac') {
        modeMenu.value = mode;
        extension.add(mode);
    } else {
        modeMenu.value = 'global';
        proxyMenu.value = mode;
        extension.add('global');
    }
    indicatorMenu.checked = easyStorage.indicator;
    if (manifest === 3) {
        persistMenu.checked = easyStorage.persistent;
    } else {
        persistMenu.parentNode.remove();
    }
});

function createMatchProfile(id) {
    let profile = profileLET.cloneNode(true);
    let [proxy, exportbtn,, entry, addbtn, sortbtn, removebtn, matches] = profile.children;
    let server = document.createElement('option');
    proxy.textContent = server.value = server.textContent = id;
    entry.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            addbtn.click();
        }
    });
    exportbtn.addEventListener('click', (event) => {
        chrome.runtime.sendMessage({action: 'pacscript_query', params: id}, (pac_script) => {
            fileSaver(pac_script, 'x-ns-proxy-autoconfig;', id.replace(/[\s:]/g, '_'), '.pac');
        });
    });
    addbtn.addEventListener('click', (event) => {
        saveBtn.disabled = false;
        let storage = easyStorage[id];
        entry.value.match(/[^\s\r\n+=,;"'`\\|/?!@#$%^&()\[\]{}<>]+/g)?.forEach((value) => {
            if (value && !storage.includes(value)) {
                createMatchPattern(matches, id, value);
                storage.push(value);
            }
        });
        entry.value = '';
        matches.scrollTop = matches.scrollHeight;
    });
    sortbtn.addEventListener('click', (event) => {
        saveBtn.disabled = false;
        easyStorage[id].sort();
        let resort = [...matches.children].sort((a, b) => a.textContent.localeCompare(b.textContent));
        matches.append(...resort);
    });
    removebtn.addEventListener('click', (event) => {
        saveBtn.disabled = false;
        easyProfile[id].remove();
        easyStorage.proxies.splice(easyStorage.proxies.indexOf(id), 1);
        delete easyStorage[id];
    });
    easyStorage[id].forEach((value) => createMatchPattern(matches, id, value));
    easyProfile[id] = profile;
    proxyMenu.appendChild(server);
    manager.appendChild(profile);
}

function createMatchPattern(list, id, value) {
    let match = matchLET.cloneNode(true);
    match.querySelector('div').textContent = match.title = value;
    match.querySelector('button').addEventListener('click', (event) => {
        saveBtn.disabled = false;
        match.remove();
        easyStorage[id].splice(easyStorage[id].indexOf(value), 1);
    });
    list.appendChild(match);
}
