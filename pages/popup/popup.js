var easyMatch = {};
var easyMatchTempo = {};
var easyProxy;
var easyQuery = false;
var easyId;
var easyHosts = [];
var changes = {};
var checkboxes = [];
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

async function proxyQuery() {
    easyQuery = true;
    var [{id, url}] = await chrome.tabs.query({active: true, currentWindow: true});
    easyId = id;
    queryBtn.style.display = 'none';
    chrome.tabs.sendMessage(easyId, {query: 'easyproxy_inspect'}).then(({result}) => {
        result.forEach(matchCreate);
    }).catch((error) => {
        matchCreate(easyMatchPattern(new URL(url).hostname));
    });
}

async function proxySubmit() {
    var proxy = proxies.value;
    var {include, exclude} = proxyChange('match', proxy, easyStorage[proxy], easyMatch);
    await chrome.runtime.sendMessage({action: 'options_onchange', params: {storage: easyStorage}});
    chrome.tabs.reload(easyId);
}

async function proxyTempo(remove) {
    var proxy = proxies.value;
    if (remove) {
        return proxyTempoPurge(proxy);
    }
    if (easyTempo[proxy] === undefined) {
        easyTempo[proxy] = [];
    }
    var {include, exclude} = proxyChange('tempo', proxy, easyTempo[proxy], easyMatchTempo);
    await chrome.runtime.sendMessage({action: 'easyproxy_changetempo', params: {proxy, include, exclude}});
    chrome.tabs.reload(easyId);
}

async function proxyTempoPurge(proxy) {
    easyMatchTempo = {};
    easyTempo = {};
    easyHosts.forEach((match) => {
        match.parentNode.classList.remove('tempo');
        match.checked = easyMatch[match.value] === proxy || easyMatchTempo[match.value] === proxy ? true : false;
    });
    await chrome.runtime.sendMessage({action: 'easyproxy_purgetempo'})
    chrome.tabs.reload(easyId);
}

function proxyChange(type, proxy, storage, logs) {
    var include = [];
    var exclude = [];
    checkboxes.forEach((match) => {
        var {value, checked} = match;
        if (checked && logs[value] === undefined) {
            logs[value] = proxy;
            include.push(value);
            storage.push(value);
            return match.parentNode.classList.add(type);
        }
        if (!checked && logs[value] !== undefined) {
            delete logs[value];
            storage.splice(storage.indexOf(value), 1);
            exclude.push(value);
            return match.parentNode.classList.remove(type);
        }
    });
    changes = {};
    checkboxes = [];
    return {include, exclude};
}

document.addEventListener('change', (event) => {
    if (event.target.type === 'checkbox') {
        return matchUpdate(event.target);
    }
    if (event.target.id === 'proxy') {
        return proxyUpdate(event.target.value);
    }
});

function matchUpdate(check) {
    if (changes[check.value] === undefined) {
        checkboxes.push(check);
    }
    changes[check.value] = check.checked;
}

function proxyUpdate(proxy) {
    easyProxy = proxy;
    if (easyQuery) {
        easyHosts.forEach((match) => {
            match.checked = easyMatch[match.value] === proxy || easyMatchTempo[match.value] === proxy ? true : false;
        });
    }
}

function matchCreate(match, id) {
    var host = hostLET.cloneNode(true);
    var [check, label] = host.querySelectorAll('input, label');
    check.id = 'easyproxy_' + id;
    label.setAttribute('for', 'easyproxy_' + id);
    label.textContent = check.value = match;
    if (easyMatch[match] !== undefined) {
        host.classList.add('match');
    }
    if (easyMatchTempo[match] !== undefined) {
        host.classList.add('tempo');
    }
    if (easyMatch[match] === easyProxy || easyMatchTempo[match] === easyProxy) {
        check.checked = true;
    }
    easyHosts.push(check);
    output.append(host);
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
