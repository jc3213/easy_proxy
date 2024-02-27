chrome.runtime.onMessage.addListener(({query}, sender, response) => {
    switch (query) {
        case 'easyproxy_inspect':
            response(inspectProxyItems());
            break;
    }
});

function inspectProxyItems(archive = {}, result = []) {
    document.querySelectorAll('[href], [src]').forEach((link) => {
        var url = link.href || link.src;
        if (!url) {
            return;
        }
        var {hostname} = new URL(url);
        if (hostname === '' || archive[hostname]) {
            return;
        }
        archive[hostname] = hostname.indexOf('.');
        if (archive[hostname] === hostname.lastIndexOf('.')) {
            return result.push(hostname);
        }
        result.push('*.' + hostname.slice(archive[hostname] + 1));
    });
    result.sort().unshift(location.hostname, '*.' + location.hostname);
    return {result: [...new Set(result)]};
}
