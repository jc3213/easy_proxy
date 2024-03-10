chrome.runtime.onMessage.addListener(({query}, sender, response) => {
    switch (query) {
        case 'easyproxy_inspect':
            response(inspectProxyItems());
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
        if (hostname === '') {
            return;
        }
        var match = createMatchPattern(hostname);
        if (archive[match]) {
            return;
        }
        archive[match] = true;
        result.push(match);
    });
    return {result: result.sort()};
}
