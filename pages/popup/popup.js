var [output, queryBtn, proxies, submitBtn, tempoBtn] = document.querySelectorAll('#output, select, button');
var hostLET = document.querySelector('.template > .host');
var easyId;

document.addEventListener('keydown', (event) => {
    if (event.ctrlKey && event.key === 's') {
        event.preventDefault();
        submitBtn.click();
    }
});

document.addEventListener('click', (event) => {
    switch (event.target.dataset.bid) {
        case 'query_btn':
            proxyQuery();
            break;
        case 'submit_btn':
            proxySubmit();
            break;
        case 'tempo_btn':
            proxyTempo(event.ctrlKey && event.altKey);
            break;
        case 'options_btn':
            chrome.runtime.openOptionsPage();
            break;
    }
});

async function proxyQuery() {
    queryBtn.style.display = 'none';
    var [{id, url}] = await chrome.tabs.query({active: true, currentWindow: true});
    easyId = id;
    chrome.tabs.sendMessage(easyId, {query: 'easyproxy_inspect'}).then(({result}) => {
        result.forEach(hostCreate);
    }).catch((error) => {
        hostCreate(new URL(url).hostname, 0);
    });
}

async function proxySubmit() {
    var profile = easyStorage[proxies.value];
    document.querySelectorAll('input:checked').forEach(({value}) => {
        if (!profile.includes(value)) {
            profile.push(value);
        }
    });
    await chrome.runtime.sendMessage({action: 'options_onchange', params: {storage: easyStorage}});
    chrome.tabs.reload(easyId);
}

async function proxyTempo(remove) {
    if (remove) {
        return chrome.runtime.sendMessage({action: 'easyproxy_purgetempo'});
    }
    var proxy = proxies.value;
    var matches = [];
    document.querySelectorAll('input:checked').forEach(({value}) => {
        if (!matches.includes(value)) {
            matches.push(value);
        }
    });
    await chrome.runtime.sendMessage({action: 'easyproxy_newtempo', params: {proxy, matches}});
    chrome.tabs.reload(easyId);
}

function hostCreate(proxy, id) {
    var host = hostLET.cloneNode(true);
    var [check, label] = host.querySelectorAll('input, label');
    check.id = 'easyproxy_' + id;
    label.setAttribute('for', 'easyproxy_' + id);
    label.textContent = check.value = proxy;
    output.append(host);
}

chrome.runtime.sendMessage({action: 'options_plugins'}, ({storage, pac_script}) => {
    easyStorage = storage;
    if (storage.proxies.length > 0) {
        return storage.proxies.forEach(proxyCreate);
    }
    proxies.disabled = submitBtn.disabled = tempoBtn.disabled = true;
});

function proxyCreate(result) {
    var menu = document.createElement('option');
    menu.textContent = menu.title = menu.value = result;
    proxies.append(menu);
}
