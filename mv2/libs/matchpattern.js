(() => {
    const version = '0.3';

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

    const create = (string) => {
        if (caches[string]) {
            return caches[string];
        }

        const test = string.match(/^(?:https?|ftps?|wss?)?:?(?:\/\/)?((?:[^\./:]+\.)+[^\./:]+):?(?:\d+)?\/?(?:[^\/]+\/?)*$/);

        if (!test) {
            throw new Error('"' + string + '" is either not a URL, or a valid MatchPattern');
        }

        const host = test[1];
        
        if (caches[host]) {
            return caches[string] = caches[host];
        }

        if (/((25[0-5]|(2[0-4]|1[0-9]|[1-9]?)[0-9])\.){3}(25[0-5]|(2[0-4]|1[0-9]|[1-9])?[0-9])/.test(host)) {
            return caches[string] = host.replace(/\d+\.\d+$/, '*');
        }

        const [hostname, sbd, sld, tld] = host.match(/(?:([^\.]+)\.)?([^\.]+)\.([^\.]+)$/);

        if (!sbd || !tlds[sld]) {
            return caches[string] = '*.' + sld + '.' + tld;
        }

        return caches[string] = '*.' + sbd + '.' + sld + '.' + tld;
    };

    const stringify = (array) => {
        if (!Array.isArray(array)) {
            throw new Error('"' + array + '" must be an array of MatchPatterns');
        }

        if (array.length === 0) {
            return '!';
        }

        if (array.includes('<all-urls>') || array.includes('*')) {
            return '.*';
        }

        return '^(' + array.join('|').replace(/\./g, '\\.').replace(/\*\\\./g, '([^.]+\\.)*').replace(/\\\.\*/g, '(\\.[^.]+)*') + ')$';
    };

    const regexp = (array) => {
        const string = stringify(array);
        return new RegExp(string);
    };

    const generate = (array) => {
        const string = stringify(array);
        return { regexp: new RegExp(string), string } ;
    };

    self.MatchPattern = { create, regexp, generate, version };
})();
