var easyProfile = {};
var easyProxy = {};
var removed = [];
var [newBtn, saveBtn, importBtn, exportBtn, submitBtn] = document.querySelectorAll('#menu > button, #profile > button');
var [exporter, manager] = document.querySelectorAll('a, #manager');
var [profileLET, matchLET] = document.querySelectorAll('.template > *');
document.querySelectorAll('#profile > [name]').forEach((item) => easyProxy[item.name] = item);

document.addEventListener('keydown', (event) => {
    if (event.ctrlKey && event.key === 's') {
        event.preventDefault();
        saveBtn.click();
    }
});

newBtn.addEventListener('click', (event) => {
    document.body.classList.toggle('new_profile');
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
    fileExporter(JSON.stringify(easyStorage, null, 4), 'json', 'easy_proxy', '.json');
});

function fileExporter(data, type, filename, filetype) {
    var blob = new Blob([data], {type: 'application/' + type + ';charset=utf-8;'});
    exporter.href = URL.createObjectURL(blob);
    exporter.download = filename + '-' + new Date().toLocaleString('ja').replace(/[\/\s:]/g, '_') + filetype;
    exporter.click();
}

easyProxy.host.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        submitBtn.click();
    }
});

submitBtn.addEventListener('click', (event) => {
    var proxy = easyProxy.proxy.value;
    if (/([^\.]+\.){1,}[^:]+(:\d+)?/.test(proxy)) {
        var profile = easyProxy.scheme.value + ' ' + proxy;
        easyStorage[profile] = [];
        easyStorage.proxies.push(profile);
        createMatchProfile(profile);
        easyProxy.scheme.value = 'PROXY';
        easyProxy.proxy.value = '';
        document.body.classList.remove('new_profile');
        saveBtn.disabled = false;
    }
});

document.getElementById('import-options').addEventListener('change', async (event) => {
    var result = await fileReader(event.target.files[0]);
    var json = JSON.parse(result);
    var removed = easyStorage.proxies.filter((proxy) => !json[proxy]);
    manager.innerHTML = '';
    easyStorage = json;
    easyStorage.proxies.forEach(createMatchProfile);
    optionsSaved();
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
    easyStorage.proxies.forEach(createMatchProfile);
});

function createMatchProfile(id) {
    var profile = profileLET.cloneNode(true);
    var [proxy, exportbtn, entry, addbtn, sortbtn, removebtn, matches] = profile.querySelectorAll('.proxy, input, button, .matches');
    proxy.textContent = id;
    entry.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            addPattern(matches, id, entry);
        }
    });
    exportbtn.addEventListener('click', (event) => exportPacScript(id));
    addbtn.addEventListener('click', (event) => addPattern(matches, id, entry));
    sortbtn.addEventListener('click', (event) => resortPattern(matches, id));
    removebtn.addEventListener('click', (event) => profileRemove(id));
    easyStorage[id].forEach((value) => createPattern(matches, id, value));
    easyProfile[id] = profile;
    manager.appendChild(profile);
}

function exportPacScript(proxy) {
    chrome.runtime.sendMessage({action: 'options_pacscript', params: {proxy}}, ({pac_script}) => {
        fileExporter(pac_script, 'x-ns-proxy-autoconfig;', proxy.replace(/[\s:]/g, '_'), '.pac');
    });
}

function createPattern(list, id, value) {
    var match = matchLET.cloneNode(true);
    match.querySelector('div').textContent = match.title = value;
    match.querySelector('button').addEventListener('click', (event) => removePattern(id, value, match));
    list.appendChild(match);
}

function addPattern(list, id, entry) {
    saveBtn.disabled = false;
    var storage = easyStorage[id];
    entry.value.match(/[^\s\r\n+=,;"'`\\|/?!@#$%^&()\[\]{}<>]+/g)?.forEach((value) => {
        if (value && !storage.includes(value)) {
            createPattern(list, id, value);
            storage.push(value);
        }
    });
    entry.value = '';
    list.scrollTop = list.scrollHeight;
}

function resortPattern(list, id) {
    saveBtn.disabled = false;
    easyStorage[id].sort();
    var resort = [...list.children].sort((a, b) => a.textContent.localeCompare(b.textContent));
    list.append(...resort);
}

function removePattern(id, value, match) {
    saveBtn.disabled = false;
    match.remove();
    easyStorage[id].splice(easyStorage[id].indexOf(value), 1);
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
