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
        if (archive[hostname] !== hostname.lastIndexOf('.')) {
            var domain = '*.' + hostname.slice(archive[hostname] + 1);
            if (archive[domain] !== undefined) {
                return;
            }
            archive[domain] = true;
            return result.push(domain);
        }
        result.push(hostname);
    });
    var {hostname} = location;
    if (archive[hostname] === undefined) {
        result = [...result, hostname].sort();
    }
    return {result};
}
