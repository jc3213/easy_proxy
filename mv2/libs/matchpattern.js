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

    const ipv4_tester = /((25[0-5]|(2[0-4]|1[0-9]|[1-9])?[0-9])\.){3}25[0-5]|(2[0-4]|1[0-9]|[1-9])?[0-9]/;

    const create = (hostname) => {
        if (ipv4_tester.test(hostname)) {
            return ipv4_handler(hostname);
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

    const ipv4_handler = (ipv4) => {
        let [network, host, ...useless] = ipv4.split('.');
        return network + '.' + host + '.*';
    };

    window.easyMatchPattern = (hostname) => {
        return cache[hostname] || create(hostname);
    };
})();
