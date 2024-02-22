var [output, query, proxy, submitBtn] = document.querySelectorAll('#output, select, button');
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
        case 'options_btn':
            chrome.runtime.openOptionsPage();
            break;
    }
});

async function proxyQuery() {
    output.innerHTML = '';
    var tabs = await chrome.tabs.query({active: true, currentWindow: true});
    easyId = tabs[0].id;
    var params = await chrome.tabs.sendMessage(easyId, {query: 'easyproxy_inspect'});
    params.result.forEach(hostCreate);
}

async function proxySubmit() {
    var storage = easyStorage[proxy.value];
    document.querySelectorAll('input:checked').forEach(({value}) => {
        if (!storage.includes(value)) {
            storage.push(value);
        }
    });
    await chrome.runtime.sendMessage({action: 'options_onchange', params: {storage: easyStorage}});
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

chrome.runtime.sendMessage({action: 'options_plugins'}, ({storage, pacscript}) => {
    easyStorage = storage;
    if (storage.proxies.length === 0) {
        proxy.disabled = submitBtn.disabled = true;
        return;
    }
    storage.proxies.forEach(proxyCreate);
});

function proxyCreate(result) {
    var menu = document.createElement('option');
    menu.textContent = menu.title = menu.value = result;
    proxy.append(menu);
}
