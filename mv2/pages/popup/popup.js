var easyMatch = {};
var easyMatchTempo = {};
var easyProxy;
var easyTab;
var easyId = 0;
var easyHosts = [];
var easyPort = chrome.runtime.connect({name: 'easyproxy-manager'});
var changes = {};
var checkLogs = {};
var checkboxes = [];
var [output, proxies, submitBtn, tempoBtn] = document.querySelectorAll('#output, #proxy, button');
var hostLET = document.querySelector('.template > .host');

document.querySelectorAll('[i18n]').forEach((node) => {
    node.textContent = chrome.i18n.getMessage(node.getAttribute('i18n'));
});

document.addEventListener('keydown', (event) => {
    if (event.ctrlKey && event.key === 's') {
        event.preventDefault();
        submitBtn.click();
    }
});

document.addEventListener('click', (event) => {
    switch (event.target.dataset.bid) {
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

function proxySubmit() {
    var manage = proxyChange('match', easyStorage, easyMatch);
    if (manage) {
        easyPort.postMessage({action: 'match_submit', params: {storage: easyStorage, tabId: easyTab}});
    }
}

function proxyTempo(remove) {
    var manage = proxyChange('tempo', easyTempo, easyMatchTempo);
    if (manage) {
        easyPort.postMessage({action: 'tempo_update', params: {tempo: easyTempo, tabId: easyTab}});
    }
}

function proxyTempoPurge(proxy) {
    easyMatchTempo = {};
    easyTempo = {};
    easyHosts.forEach((match) => {
        match.parentNode.classList.remove('tempo');
        match.checked = easyMatch[match.value] === proxy || easyMatchTempo[match.value] === proxy ? true : false;
    });
    easyPort.postMessage({action: 'tempo_purge', params: {tabId: easyTab}});
}

function proxyChange(type, storage, logs) {
    var proxy = proxies.value;
    var include = [];
    var exclude = [];
    var matches = storage[proxy] || [];
    checkboxes.forEach((check) => {
        var {value, checked} = check;
        var status = check.parentNode.classList[1];
        if (status && status !== type) {
            check.checked = checkLogs[value];
            return;
        }
        if (checked && !logs[value]) {
            logs[value] = proxy;
            include.push(value);
            matches.push(value);
            return check.parentNode.classList.add(type);
        }
        if (!checked && logs[value]) {
            delete logs[value];
            matches.splice(matches.indexOf(value), 1);
            exclude.push(value);
            return check.parentNode.classList.remove(type);
        }
    });
    changes = {};
    checkLogs = {};
    checkboxes = [];
    storage[proxy] = matches;
    return include.length !== 0 || exclude.length !== 0;
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
    var {value, checked} = check;
    if (!changes[value]) {
        checkLogs[value] = !checked;
        checkboxes.push(check);
    }
    changes[value] = checked;
}

function proxyUpdate(proxy) {
    easyProxy = proxy;
    easyHosts.forEach((match) => {
        var host = match.value;
        match.checked = easyMatch[host] === proxy || easyMatchTempo[host] === proxy;
        match.disabled = easyMatch[host] && easyMatch[host] !== proxy || easyMatchTempo[host] && easyMatchTempo[host] !== proxy;
    });
}

easyPort.onMessage.addListener(({action, params}) => {
    switch (action) {
        case 'match_respond':
            easyMatchInitial(params);
            break;
        case 'match_resync':
            output.innerHTML = '';
        case 'match_update':
            easyMatchUpdate(params);
            break;
    }
});

chrome.tabs.query({active: true, currentWindow: true}, async (tabs) => {
    easyTab = tabs[0].id;
    easyPort.postMessage({action: 'match_initial', params: {tabId: easyTab}});
});

function easyMatchInitial({storage, tempo, result}) {
    easyProxy = storage.proxies[0];
    if (!easyProxy) {
        proxies.disabled = submitBtn.disabled = tempoBtn.disabled = true;
        return;
    }
    easyStorage = storage;
    easyTempo = tempo;
    storage.proxies.forEach(easyProxyCeate);
    if (result && result.length !== 0) {
        return result.forEach(easyMatchPattern);
    }
    proxies.disabled = submitBtn.disabled = tempoBtn.disabled = true;
}

function easyProxyCeate(proxy) {
    var menu = document.createElement('option');
    menu.textContent = menu.title = menu.value = proxy;
    proxies.append(menu);
    easyStorage[proxy].forEach((match) => easyMatch[match] = proxy);
    easyTempo[proxy]?.forEach((match) => easyMatchTempo[match] = proxy);
}

function easyMatchUpdate({tabId, pattern}) {
    if (tabId === easyTab) {
        easyMatchPattern(pattern);
    }
}

function easyMatchPattern(match) {
    var host = hostLET.cloneNode(true);
    var [check, label] = host.querySelectorAll('input, label');
    check.id = 'easyproxy_' + easyId;
    label.setAttribute('for', 'easyproxy_' + easyId);
    label.textContent = check.value = match;
    if (easyMatch[match]) {
        host.classList.add('match');
    }
    if (easyMatchTempo[match]) {
        host.classList.add('tempo');
    }
    if (easyMatch[match] === easyProxy || easyMatchTempo[match] === easyProxy) {
        check.checked = true;
    }
    easyHosts.push(check);
    easyId ++;
    output.append(host);
}
