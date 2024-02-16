var [scheme, proxy, newBtn, saveBtn, exportBtn, exporter, options] = document.querySelectorAll('#menu > *, #options');
var profileLET = document.querySelector('.template > .profile');
var easyProfile = {};
var removed = [];
var easyFallback;
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
            break;
        case 'save_btn':
            optionsSave();
            break;
        case 'export_btn':
            optionsExport();
            break;
        case 'remove_btn':
            profileRemove(event.target.dataset.pid);
            break;
        case 'default_btn':
            profileFallback(event.target.dataset.pid, event.target);
            break;
    }
});

async function optionsSave() {
    saveBtn.disabled = true;
    var {pac_script} = await chrome.runtime.sendMessage({action: 'options_onchange', params: {storage: easyStorage, removed}});
    easyPAC = pac_script;
}

function optionsExport() {
    var time = new Date().toLocaleString('ja').replace(/[\/\s:]/g, '_');
    var blob = new Blob([easyPAC], {type: 'application/x-ns-proxy-autoconfig; charset=utf-8'});
    exporter.href = URL.createObjectURL(blob);
    exporter.download = 'easy_proxy-' + time + '.pac';
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
    saveBtn.disabled = false;
    easyProfile[id].remove();
    easyStorage.proxies.splice(easyStorage.proxies.indexOf(id), 1);
    if (easyStorage.fallback === id) {
        easyStorage.fallback === null;
    }
    if (!removed.includes(id)) {
        removed.push(id);
    }
    delete easyStorage[id];
}

function profileFallback(id, fallback) {
    saveBtn.disabled = false;
    easyFallback?.classList.remove('checked');
    if (easyFallback === fallback) {
        easyStorage.fallback = easyFallback = null;
        return;
    }
    easyStorage.fallback = id;
    easyFallback = fallback;
    fallback.classList.add('checked');
}

function profileCreate(id) {
    var profile = profileLET.cloneNode(true);
    var [proxy, fallback, erase, hosts] = profile.querySelectorAll('.proxy, button, textarea');
    Object.assign(profile, {proxy, fallback, erase, hosts});
    proxy.textContent = erase.dataset.pid = fallback.dataset.pid = hosts.dataset.pid = id;
    options.append(profile);
    easyProfile[id] = profile;
    return profile;
}

document.addEventListener('change', (event) => {
    var {dataset: {nid, pid}, value} = event.target;
    if (nid && proxy.value) {
        newProfile = scheme.value + ' ' + proxy.value;
        newBtn.disabled = newProfile in easyStorage || !/(\w+\.)+\w+(:\d+)?/.test(proxy.value) ? true : false;
        return;
    }
    if (pid) {
        easyStorage[pid] = value;
        saveBtn.disabled = false;
        return;
    }
});

chrome.runtime.sendMessage({action: 'options_plugins'}, ({storage, pacscript}) => {
    easyStorage = storage;
    easyPAC = pacscript;
    easyStorage.proxies.forEach((proxy) => {
        var profile = profileCreate(proxy);
        profile.hosts.value = easyStorage[proxy];
        if (easyStorage.fallback === proxy) {
            easyFallback = profile.fallback;
            profile.fallback.classList.add('checked');
        }
    });
});
