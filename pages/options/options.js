var [scheme, proxy, newBtn, saveBtn, exportBtn, exporter, options] = document.querySelectorAll('#menu > *, #options');
var profileLET = document.querySelector('.template > .profile');
var easyProfile = {};
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

function optionsSave() {
    saveBtn.disabled = true;
    easyPAC = convertJsonToPAC(easyStorage);
    chrome.storage.sync.set(easyStorage);
    chrome.runtime.sendMessage(easyPAC);
}

function optionsExport() {
    var time = new Date().toLocaleString('ja').replace(/[\/\s:]/g, '_');
    var blob = new Blob([easyPAC], {type: 'application/x-ns-proxy-autoconfig; charset=utf-8'});
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
    saveBtn.disabled = false;
    easyProfile[id].remove();
    easyStorage.proxies.splice(easyStorage.proxies.indexOf(id), 1);
    delete easyProfile[id];
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
    var [proxy, fallback, remove, hosts] = profile.querySelectorAll('.proxy, button, textarea');
    Object.assign(profile, {proxy, fallback, remove, hosts});
    proxy.textContent = remove.dataset.pid = fallback.dataset.pid = hosts.dataset.pid = id;
    options.append(profile);
    easyProfile[id] = profile;
    return profile;
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

init((storage, pac) => {
    easyStorage.proxies.forEach((proxy) => {
        var profile = profileCreate(proxy);
        profile.hosts.value = storage[proxy];
        if (storage.fallback === proxy) {
            easyFallback = profile.fallback;
            profile.fallback.classList.add('checked');
        }
    });
});
