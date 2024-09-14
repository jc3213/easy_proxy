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

    const tester = /((25[0-5]|(2[0-4]|1[0-9]|[1-9]?)[0-9])\.){3}(25[0-5]|(2[0-4]|1[0-9]|[1-9])?[0-9])/;

    const ipv4 = (ipv4) => {
        let [network, host, ...useless] = ipv4.split('.');
        let result = network + '.' + host + '.*';
        cache[ipv4] = result;
        return result;
    };

    const make = (hostname) => {
        if (tester.test(hostname)) {
            return ipv4(hostname);
        }

        let result;
        let [tld, sld, sbd, ...useless] = hostname.split('.').reverse();

        if (sld === undefined) {
            result = hostname;
        }
        else if (sld in tlds) {
            result = '*.' + sbd + '.' + sld + '.' + tld;
        }
        else {
            result = '*.' + sld + '.' + tld;
        }

        cache[hostname] = result;
        return result;
    };

    const host = (hostname) => {
        return cache[hostname] ?? make(hostname);
    };
    
    const url = (url) => {
        return host[new URL(url.hostname];
    }
    
    self.MatchPattern = {url, host};
})();
