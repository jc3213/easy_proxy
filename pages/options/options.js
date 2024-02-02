var [scheme, proxy, newBtn, saveBtn, exportBtn, exporter, options] = document.querySelectorAll('#menu > *, #options');
var profileLET = document.querySelector('.template > .profile');
var easyProfile = {};
var easyDefault = {
    proxies: []
};
var newProfile;

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
        case 'save_btn':
            optionsSave();
            break;
        case 'export_btn':
            optionsExport();
            break;
        case 'remove_btn':
            profileRemove(event.target.dataset.pid);
            break;
    }
});

function optionsSave() {
    chrome.storage.sync.set(easyStorage);
    saveBtn.disabled = true;
}

function optionsExport() {
    var time = new Date().toLocaleString('ja').replace(/[\/\s:]/g, '_');
    var blob = new Blob([convertRules(easyStorage)], {type: 'application/x-ns-proxy-autoconfig; charset=utf-8'});
    exporter.href = URL.createObjectURL(blob);
    exporter.download = `easy_proxy-${time}.pac`;
    exporter.click();
}

function profileNew() {
    newBtn.disabled = true;
    saveBtn.disabled = false;
    profileCreate(newProfile);
    easyStorage[newProfile] = '';
    easyStorage.proxies.push(newProfile);
}

function profileRemove(id) {
    easyProfile[id].remove();
    saveBtn.disabled = false;
    easyStorage.proxies.splice(easyStorage.proxies.indexOf(id), 1);
    delete easyProfile[id];
    delete easyStorage[id];
}

function profileCreate(id) {
    var profile = profileLET.cloneNode(true);
    var [proxy, remove, hosts] = profile.querySelectorAll('*');
    easyProfile[id] = profile;
    proxy.textContent = remove.dataset.pid = hosts.dataset.pid = id;
    options.append(profile);
    return hosts;
}

document.addEventListener('change', (event) => {
    var {id, dataset: {pid}, value} = event.target;
    if (id) {
        newProfile = `${scheme.value} ${proxy.value}`;
        newBtn.disabled = newProfile in easyStorage ? true : false;
        return;
    }
    if (pid) {
        easyStorage[pid] = value;
        saveBtn.disabled = false;
        return;
    }
});

chrome.storage.sync.get(null, (json) => {
    easyStorage = {...easyDefault, ...json};
    easyStorage.proxies.forEach((proxy) => {
        var profile = profileCreate(proxy);
        profile.value = json[proxy];
    });
});