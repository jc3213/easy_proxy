var easyProfile = {};
var easyProxy = {};
var easyModes = ['direct', 'autopac', 'global'];
var removed = [];

var extension = document.body.classList;
var [newBtn, optionsBtn, saveBtn, importBtn, exportBtn, submitBtn] = document.querySelectorAll('#menu > button, #profile > button');
var [exporter, modeMenu, proxyMenu, indicatorMenu, persistMenu, manager] = document.querySelectorAll('a, #options [id], #manager');
var [profileLET, matchLET] = document.querySelectorAll('.template > *');
var [schemeEntry, hostEntry, portEntry] = document.querySelectorAll('#profile > [name]');

document.querySelectorAll('[i18n]').forEach((node) => {
    node.textContent = chrome.i18n.getMessage(node.getAttribute('i18n'));
});

document.querySelectorAll('[i18n-tips]').forEach((node) => {
    node.title = chrome.i18n.getMessage(node.getAttribute('i18n-tips'));
});

document.addEventListener('keydown', (event) => {
    if (event.ctrlKey && event.key === 's') {
        event.preventDefault();
        saveBtn.click();
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

saveBtn.addEventListener('click', optionsSaved);

function optionsSaved() {
    saveBtn.disabled = true;
    chrome.runtime.sendMessage({action: 'options_onchange', params: {storage: easyStorage, removed}}, (params) => {
        easyPAC = params.pac_script;
        removed = [];
    });
}

exportBtn.addEventListener('click', (event) => {
    fileSaver(JSON.stringify(easyStorage, null, 4), 'json', 'easy_proxy', '.json');
});

function fileSaver(data, type, filename, filetype) {
    var blob = new Blob([data], {type: 'application/' + type + ';charset=utf-8;'});
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
    var profile = schemeEntry.value + ' ' + hostEntry.value + ':' + portEntry.value;
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

document.getElementById('import-options').addEventListener('change', (event) => {
    var reader = new FileReader();
    reader.onload = (event) => {
        var json = JSON.parse(reader.result);
        var removed = easyStorage.proxies.filter((proxy) => !json[proxy]);
        manager.innerHTML = '';
        easyStorage = json;
        easyStorage.proxies.forEach(createMatchProfile);
        optionsSaved();
        event.target.value = '';
    };
    reader.readAsText(event.target.files[0]);
});

modeMenu.addEventListener('change', (event) => {
    var mode = event.target.value;
    var hide = easyModes.filter((key) => key !== mode);
    extension.add(mode);
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

chrome.runtime.sendMessage({action: 'options_initial'}, ({storage, pac_script, manifest}) => {
    var mode = storage.direct;
    easyStorage = storage;
    easyPAC = pac_script;
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
    var profile = profileLET.cloneNode(true);
    var [proxy, exportbtn, entry, addbtn, sortbtn, removebtn, matches] = profile.querySelectorAll('.proxy, input, button, .matches');
    var server = document.createElement('option');
    proxy.textContent = server.value = server.textContent = id;
    entry.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            addbtn.click();
        }
    });
    exportbtn.addEventListener('click', (event) => {
        chrome.runtime.sendMessage({action: 'options_pacscript', params: id}, (pac_script) => {
            fileSaver(pac_script, 'x-ns-proxy-autoconfig;', id.replace(/[\s:]/g, '_'), '.pac');
        });
    });
    addbtn.addEventListener('click', (event) => {
        saveBtn.disabled = false;
        var storage = easyStorage[id];
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
        var resort = [...matches.children].sort((a, b) => a.textContent.localeCompare(b.textContent));
        matches.append(...resort);
    });
    removebtn.addEventListener('click', (event) => {
        saveBtn.disabled = false;
        easyProfile[id].remove();
        easyStorage.proxies.splice(easyStorage.proxies.indexOf(id), 1);
        removed.push(id);
        delete easyStorage[id];
    });
    easyStorage[id].forEach((value) => createMatchPattern(matches, id, value));
    easyProfile[id] = profile;
    proxyMenu.appendChild(server);
    manager.appendChild(profile);
}

function createMatchPattern(list, id, value) {
    var match = matchLET.cloneNode(true);
    match.querySelector('div').textContent = match.title = value;
    match.querySelector('button').addEventListener('click', (event) => {
        saveBtn.disabled = false;
        match.remove();
        easyStorage[id].splice(easyStorage[id].indexOf(value), 1);
    });
    list.appendChild(match);
}
