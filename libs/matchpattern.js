(function() {
    const popularTopLevelDomains = {
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

    const createMatchPattern = function (hostname) {
        var [tld, sld, sbd, ...useless] = hostname.split('.').reverse();
        if (sld === undefined) {
            return hostname;
        }
        if (sld in popularTopLevelDomains) {
            return '*.' + sbd + '.' + sld + '.' + tld;
        }
        return '*.' + sld + '.' + tld;
    }

    self.createMatchPattern = createMatchPattern;
})();
