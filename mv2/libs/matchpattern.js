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

    const caches = {};

    const make = (host) => {
        if (/((25[0-5]|(2[0-4]|1[0-9]|[1-9]?)[0-9])\.){3}(25[0-5]|(2[0-4]|1[0-9]|[1-9])?[0-9])/.test(host)) {
            return host.replace(/\d+\.\d+$/, '*');
        }

        const [hostname, sbd, sld, tld] = host.match(/(?:([^\.]+)\.)?([^\.]+)\.([^\.]+)$/);

        if (!sbd || !tlds[sld]) {
            return '*.' + sld + '.' + tld;
        }

        return '*.' + sbd + '.' + sld + '.' + tld;
    };
    
    self.MatchPattern = (string) => {
        if (caches[string]) {
            return caches[string];
        }

        const test = string.match(/^(?:http|ftp|ws)?s?:?(?:\/\/)?((?:[^\./:]+\.)+[^\./:]+):?(?:\d+)?\/?(?:[^\/]+\/?)*$/);

        if (!test) {
            throw new Error ('"' + string + '" is either not a URL, or a valid MatchPattern');
        }

        const host = test[1];
        
        if (caches[host]) {
            return caches[string] = caches[host];
        }

        if (host.includes('*')) {
            return caches[string] = host;
        }

        return caches[string] = make(host);
    };
})();
