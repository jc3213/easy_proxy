chrome.runtime.onMessage.addListener(({query}, sender, response) => {
    switch (query) {
        case 'easyproxy_inspect':
            response({result: inspectProxyItems()});
            break;
    }
});

function inspectProxyItems(archive = {}, result = []) {
    [location, ...document.querySelectorAll('[href], [src]')].forEach((link) => {
        var url = link.href || link.src;
        if (!url) {
            return;
        }
        var {hostname} = new URL(url);
        var domain = hostname.slice(hostname.indexOf('.') + 1);
        if (!domain || domain in history) {
            return;
        }
        history[domain] = true;
        if (domain.includes('.')) {
            return result.push('*.' + domain);
        }
        result.push(hostname);
    });
    result.sort();
    return result;
}
