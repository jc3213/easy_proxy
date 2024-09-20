(() => {
    const tlds = {
        'aero': true,
        'app': true,
        'arpa': true,
        'asia': true,
        'biz': true,
        'cat': true,
        'co': true,
        'com': true,
        'coop': true,
        'dev': true,
        'edu': true,
        'eu': true,
        'gov': true,
        'info': true,
        'int': true,
        'io': true,
        'jobs': true,
        'ltd': true,
        'ltda': true,
        'mil': true,
        'mobi': true,
        'museum': true,
        'name': true,
        'ne': true,
        'net': true,
        'org': true,
        'post': true,
        'pro': true,
        'si': true,
        'tel': true,
        'test': true,
        'travel': true,
        'web': true,
        'xxx': true,
        'xyz': true
    };

    const cache = {};

    const make = (hostname) => {
        if (/((25[0-5]|(2[0-4]|1[0-9]|[1-9]?)[0-9])\.){3}(25[0-5]|(2[0-4]|1[0-9]|[1-9])?[0-9])/.test(hostname)) {
            return hostname.replace(/\d+\.\d+$/, '*');
        }

        var [host, sbd, sld, tld] = hostname.match(/(?:([^\.]+)\.)?([^\.]+)\.([^\.]+)$/);

        if (!sbd || !tlds[sld]) {
            return '*.' + sld + '.' + tld;
        }

        return '*.' + sbd + '.' + sld + '.' + tld;
    };

    const host = (hostname) => {
        return cache[hostname] ??= make(hostname);
    };
    
    const url = (url) => {
        return host(new URL(url).hostname);
    };
    
    self.MatchPattern = {url, host};
})();
