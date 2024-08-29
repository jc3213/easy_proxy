var easyProfile = {};
var easyProxy = {};
var removed = [];
var options = document.body.classList;
var [saveBtn, profile, exporter, manager] = document.querySelectorAll('[data-bid="save_btn"], a, #profile, #manager');
var [profileLET, pacLET, matchLET] = document.querySelectorAll('.template > *');
document.querySelectorAll('#profile > [name]').forEach((item) => easyProxy[item.name] = item);

document.addEventListener('keydown', (event) => {
    if (event.ctrlKey && event.key === 's') {
        event.preventDefault();
        saveBtn.click();
    }
});

document.getElementById('menu').addEventListener('click', (event) => {
    switch (event.target.dataset.bid) {
        case 'new_btn':
            options.toggle('new_profile');
            break;
        case 'save_btn':
            optionsSaved();
            break;
        case 'export_btn':
            optionsExport(event.ctrlKey && event.altKey);
            break;
        case 'submit_btn':
            profileSubmit();
            break;
    }
});

async function optionsSaved() {
    saveBtn.disabled = true;
    chrome.runtime.sendMessage({action: 'options_onchange', params: {storage: easyStorage, removed}}, (params) => {
        easyPAC = params.pac_script;
        removed = [];
    });
}

function optionsExport(pacScript) {
    if (pacScript) {
        var data = easyPAC;
        var type = 'application/x-ns-proxy-autoconfig;charset=utf-8;';
        var ext = '.pac';
    }
    else {
        data = JSON.stringify(easyStorage, null, 4);
        type = 'application/json;charset=utf-8;';
        ext = '.json';
    }
    var time = new Date().toLocaleString('ja').replace(/[\/\s:]/g, '_');
    var blob = new Blob([data], {type});
    exporter.href = URL.createObjectURL(blob);
    exporter.download = 'easy_proxy-' + time + ext;
    exporter.click();
}

document.getElementById('proxy-server').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        profileSubmit();
    }
});

document.getElementById('submit-proxy').addEventListener('click', profileSubmit);

function profileSubmit() {
    var proxy = easyProxy.proxy.value;
    if (/([^\.]+\.){1,}[^:]+(:\d+)?/.test(proxy)) {
        var profile = easyProxy.scheme.value + ' ' + proxy;
        easyStorage[profile] = [];
        easyStorage.proxies.push(profile);
        createMatchPattern(profile);
        easyProxy.scheme.value = 'PROXY';
        easyProxy.proxy.value = '';
        options.remove('new_profile');
        saveBtn.disabled = false;
    }
}

document.getElementById('import-options').addEventListener('change', async (event) => {
    var result = await fileReader(event.target.files[0]);
    var json = JSON.parse(result);
    var removed = easyStorage.proxies.filter((proxy) => !json[proxy]);
    easyStorage = json;
    manager.innerHTML = '';
    easyOptionsSetup();
    optionsSaved();
    event.target.value = '';
});

document.getElementById('import-pacs').addEventListener('change', async (event) => {
    saveBtn.disabled = true;
    await Promise.all([...event.target.files].map(async (file) => {
        var result = await fileReader(file);
        var pac = easyStorage.proxies.find((id) => easyStorage[id] === result);
        if (!pac) {
            var pacId = 'PAC ' + Date.now().toString(16);
            easyStorage[pacId] = result;
            easyStorage.pacs[pacId] = true;
            easyStorage.proxies.push(pacId);
            createPacScript(pacId);
        }
    }));
    optionsSaved();
    options.remove('new_profile');
    event.target.value = '';
});

function fileReader(file) {
    return new Promise((resolve) => {
        var reader = new FileReader();
        reader.onload = (event) => resolve(reader.result);
        reader.readAsText(file);
    });
}

chrome.runtime.sendMessage({action: 'options_initial'}, (params) => {
    easyStorage = params.storage;
    easyPAC = params.pac_script;
    easyOptionsSetup();
});

function easyOptionsSetup() {
    easyStorage.proxies.forEach((proxy) => {
        easyStorage.pacs[proxy] ? createPacScript(proxy) : createMatchPattern(proxy);
    });
}

function createMatchPattern(id) {
    var profile = profileLET.cloneNode(true);
    var [proxy, entry, matches] = profile.querySelectorAll('.proxy, input, .matches');
    proxy.textContent = id;
    entry.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            addPattern(matches, id, entry);
        }
    });
    profile.addEventListener('click', (event) => {
        switch (event.target.dataset.mid) {
            case 'append_btn':
                addPattern(matches, id, entry);
                break;
            case 'resort_btn':
                resortPattern(matches, id);
                break;
            case 'splice_btn':
                removePattern(id, event.target.parentNode);
                break;
            case 'remove_btn':
                profileRemove(id);
                break;
        }
    });
    listMatchPattern(matches, easyStorage[id]);
    easyProfile[id] = profile;
    manager.appendChild(profile);
}

function listMatchPattern(list, matches) {
    matches.forEach((value) => createPattern(list, value));
}

function addPattern(list, id, entry) {
    saveBtn.disabled = false;
    var storage = easyStorage[id];
    entry.value.match(/[^\s\r\n+=,;"'`\\|/?!@#$%^&()\[\]{}<>]+/g)?.forEach((value) => {
        if (value && !storage.includes(value)) {
            createPattern(list, value);
            storage.push(value);
        }
    });
    entry.value = '';
    list.scrollTop = list.scrollHeight;
}

function createPattern(list, value) {
    var match = matchLET.cloneNode(true);
    match.querySelector('div').textContent = match.title = value;
    list.appendChild(match);
}

function resortPattern(list, id) {
    saveBtn.disabled = false;
    easyStorage[id].sort();
    var resort = [...list.children].sort((a, b) => a.textContent.localeCompare(b.textContent));
    list.append(...resort);
}

function removePattern(id, pattern) {
    saveBtn.disabled = false;
    pattern.remove();
    var value = pattern.title;
    easyStorage[id].splice(easyStorage[id].indexOf(value), 1);
}

function createPacScript(id) {
    var profile = pacLET.cloneNode(true);
    var [proxy, pac] = profile.querySelectorAll('.proxy, .content');
    proxy.textContent = id;
    pac.innerHTML = easyStorage[id].replace(/\n/g, '<br>').replace(/\s/g, '&nbsp;');
    easyProfile[id] = profile;
    profile.addEventListener('click', (event) => {
        switch (event.target.dataset.mid) {
            case 'detail_btn':
                profileDetail(id);
                break;
            case 'remove_btn':
                profileRemove(id);
                break;
        }
    });
    manager.appendChild(profile);
}

function profileDetail(id) {
    easyProfile[id].classList.toggle('expand');
}

function profileRemove(id) {
    saveBtn.disabled = false;
    easyProfile[id].remove();
    easyStorage.proxies.splice(easyStorage.proxies.indexOf(id), 1);
    delete easyStorage.pacs[id];
    if (!removed.includes(id)) {
        removed.push(id);
    }
    delete easyStorage[id];
}
