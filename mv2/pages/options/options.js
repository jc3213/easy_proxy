var easyProfile = {};
var easyProxy;
var easyPort = chrome.runtime.connect({name: 'easyproxy-options'});
var newProfile = {
    scheme: 'PROXY',
    proxy: ''
};
var removed = [];
var [scheme, proxy, newBtn, saveBtn, importBtn, exportBtn, importer, exporter, profiles] = document.querySelectorAll('#menu > *, #profile');
var profileLET = document.querySelector('.template > .profile');

document.querySelectorAll('[i18n]').forEach((node) => {
    node.textContent = chrome.i18n.getMessage(node.getAttribute('i18n'));
});

document.addEventListener('keydown', (event) => {
    if (event.ctrlKey && event.key === 's') {
        event.preventDefault();
        saveBtn.click();
    }
});

document.addEventListener('click', (event) => {
    switch (event.target.dataset.bid) {
        case 'new_btn':
            profileNew();
            break;
        case 'save_btn':
            optionsSaved();
            break;
        case 'import_btn':
            importer.click();
            break;
        case 'export_btn':
            optionsExport(event.ctrlKey && event.altKey);
            break;
        case 'resort_btn':
            profileResort(event.target.dataset.pid);
            break;
        case 'remove_btn':
            profileRemove(event.target.dataset.pid);
            break;
    }
});

async function optionsSaved() {
    saveBtn.disabled = true;
    easyPort.postMessage({storage: easyStorage, removed});
    removed = [];
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

function profileNew() {
    newBtn.disabled = true;
    saveBtn.disabled = false;
    profileCreate(easyProxy);
    easyStorage[easyProxy] = [];
    easyStorage.proxies.push(easyProxy);
}

function profileRemove(id) {
    saveBtn.disabled = false;
    easyProfile[id].remove();
    easyStorage.proxies.splice(easyStorage.proxies.indexOf(id), 1);
    if (!removed.includes(id)) {
        removed.push(id);
    }
    delete easyStorage[id];
}

function profileResort(id) {
    saveBtn.disabled = false;
    easyProfile[id].matches.value = easyStorage[id].sort().join(' ');
}

function profileCreate(id) {
    var profile = profileLET.cloneNode(true);
    profile.querySelectorAll('[class]').forEach((item) => profile[item.className] = item);
    profile.proxy.textContent = profile.discard.dataset.pid = profile.resort.dataset.pid = profile.matches.dataset.pid = id;
    profiles.append(profile);
    easyProfile[id] = profile;
    return profile;
}

document.addEventListener('change', (event) => {
    var {dataset: {nid, pid}, value, files} = event.target;
    if (nid) {
        newProfile[nid] = value;
        profileCheck();
        return;
    }
    if (pid) {
        easyStorage[pid] = value.match(/[^\s]+/g) ?? [];
        saveBtn.disabled = false;
        return;
    }
    if (files) {
        optionsImport(files[0]);
    }
});

function profileCheck() {
    var {scheme, proxy} = newProfile;
    easyProxy = scheme + ' ' + proxy;
    newBtn.disabled = profile in easyStorage || !/([\w-]+\.)+\w+(:\d+)?/.test(proxy) ? true : false;
}

function optionsImport(file) {
    saveBtn.disabled = true;
    var fileReader = new FileReader();
    fileReader.onload = (event) => {
        var json = JSON.parse(event.target.result);
        removed = easyStorage.proxies.filter((proxy) => !json[proxy]);
        easyStorage = json;
        easyOptionsSetUp();
        optionsSaved();
    };
    fileReader.readAsText(file);
}

easyPort.onMessage.addListener(({action, params}) => {
    easyStorage = params.storage;
    easyPAC = params.pac_script;
    if (action === 'options_initial') {
        easyOptionsSetUp();
    }
});

function easyOptionsSetUp() {
    easyStorage.proxies.forEach((proxy) => {
        var profile = profileCreate(proxy);
        profile.matches.value = easyStorage[proxy].join(' ');
    });
}
