var easyMatch = {};
var easyMatchTempo = {};
var easyProxy;
var easyQuery = false;
var easyId;
var easyHosts = [];
var [queryBtn, output, proxies, submitBtn, tempoBtn] = document.querySelectorAll('#output, select, button');
var hostLET = document.querySelector('.template > .host');

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

document.addEventListener('change', (event) => {
    if (event.target.id === 'proxy') {
        return matchUpdate(event.target.value);
    }
});

async function proxyQuery() {
    easyQuery = true;
    var [{id, url}] = await chrome.tabs.query({active: true, currentWindow: true});
    easyId = id;
    queryBtn.style.display = 'none';
    chrome.tabs.sendMessage(easyId, {query: 'easyproxy_inspect'}).then(({result}) => {
        result.forEach(matchCreate);
    }).catch((error) => {
        matchCreate(new URL(url).hostname, 0);
    });
}

async function proxySubmit() {
    var proxy = proxies.value;
    var matches = easyStorage[proxies.value];
    document.querySelectorAll('input:not(:disabled):checked').forEach((match) => {
        var {value} = match;
        if (easyMatch[value] === undefined) {
            easyMatch[value] = proxy;
            matches.push(value);
            match.disabled = true;
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
    if (easyTempo[proxy] === undefined) {
        easyTempo[proxy] = [];
    }
    var matches = easyTempo[proxy];
    document.querySelectorAll('input:not(:disabled):checked').forEach((match) => {
        var {value} = match;
        if (easyMatch[value] === undefined) {
            easyMatch[value] = proxy;
            matches.push(value);
            match.parentNode.classList.add('tempo');
        }
    });
    await chrome.runtime.sendMessage({action: 'easyproxy_newtempo', params: {proxy, matches}});
    chrome.tabs.reload(easyId);
}

function matchCreate(match, id) {
    var host = hostLET.cloneNode(true);
    var [check, label] = host.querySelectorAll('input, label');
    check.id = 'easyproxy_' + id;
    label.setAttribute('for', 'easyproxy_' + id);
    label.textContent = check.value = match;
    if (easyMatch[match] === easyProxy) {
        check.checked = check.disabled = true;
    }
    if (easyMatchTempo[match] === easyProxy) {
        check.checked = true;
        host.classList.add('tempo');
    }
    easyHosts.push(check);
    output.append(host);
}

function matchUpdate(proxy) {
    easyProxy = proxy;
    if (easyQuery) {
        easyHosts.forEach((match) => {
            match.checked = easyMatch[match.value] === proxy || easyMatchTempo[match.value] === proxy ? true : false;
        });
    }
}

chrome.runtime.sendMessage({action: 'options_plugins'}, ({storage, pac_script, tempo, fallback}) => {
    easyProxy = storage.proxies[0];
    if (easyProxy === undefined) {
        proxies.disabled = submitBtn.disabled = tempoBtn.disabled = queryBtn.disabled = true;
        return;
    }
    easyStorage = storage;
    easyTempo = tempo;
    storage.proxies.forEach(proxyCreate);
    fallback.matches.forEach((match) => easyMatchTempo[match] = fallback.proxy);
});

function proxyCreate(proxy) {
    var menu = document.createElement('option');
    menu.textContent = menu.title = menu.value = proxy;
    proxies.append(menu);
    easyStorage[proxy].forEach((match) => easyMatch[match] = proxy);
    easyTempo[proxy]?.forEach((match) => easyMatchTempo[match] = proxy);
}
