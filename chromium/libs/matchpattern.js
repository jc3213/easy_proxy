class MatchPattern {
    constructor () {
        this.proxy = 'DIRECT';
        this.clear();
        MatchPattern.instances.push(this);
    }
    version = '0.5';
    add (...args) {
        args.flat().forEach((arg) => this.data.push(MatchPattern.make(arg)));
        this.data = [...new Set(this.data)];
        this.text = MatchPattern.stringnify(this.data);
        this.regexp = new RegExp(this.text);
    }
    remove (...args) {
        let remove = new Set(args.flat())
        this.data = this.data.filter((arg) => !remove.has(arg));
        this.text = MatchPattern.stringnify(this.data);
        this.regexp = new RegExp(this.text);
    }
    clear () {
        this.data = [];
        this.text = '';
        this.regexp = /!/;
    }
    test (host) {
        return this.regexp.test(host);
    }
    get pac_script () {
        let result = this.text && /^(SOCKS5?|HTTPS?) ([^.]+\.)+[^.:]+:\d+$/.test(this.proxy) ? '    if (/' + this.text + '/i.test(host)) {\n        return "' + this.proxy + '";\n    }\n' : '';
        return 'function FindProxyForURL(url, host) {\n' + result + '    return "DIRECT";\n}';
    }
    static instances = [];
    static caches = {};
    static tlds = {
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
    static make (string) {
        let result = MatchPattern.caches[string];
        if (result) {
            return result;
        }
        let test = string.match(/^(?:https?|ftps?|wss?)?:?(?:\/\/)?((?:[^./:]+\.)+[^./:]+):?(?:\d+)?\/?(?:[^\/]+\/?)*$/);
        if (!test) {
            throw new Error('"' + string + '" is either not a URL, or a valid MatchPattern');
        }
        let host = test[1];
        if (MatchPattern.caches[host]) {
            return MatchPattern.caches[host];
        }
        if (/((25[0-5]|(2[0-4]|1[0-9]|[1-9]?)[0-9])\.){3}(25[0-5]|(2[0-4]|1[0-9]|[1-9])?[0-9])/.test(host)) {
            return MatchPattern.caches[string] = MatchPattern.caches[host] = host.replace(/\d+\.\d+$/, '*');
        }
        let [_, sbd, sld, tld] = host.match(/(?:([^.]+)\.)?([^.]+)\.([^.]+)$/);
        return MatchPattern.caches[string] = MatchPattern.caches[host] = '*.' + (sbd && MatchPattern.tlds[sld] ? sbd + '.' : '') + sld + '.' + tld;
    }
    static stringnify (array) {
        if (array.length === 0) {
            return '';
        }
        if (array.includes('*')) {
            return '.*';
        }
        return '^(' + array.join('|').replace(/\./g, '\\.').replace(/\*\\\./g, '([^.]+\\.)*').replace(/\\\.\*/g, '(\\.[^.]+)*') + ')$';
    }
    static erase (...args) {
        let proxy = args.flat();
        MatchPattern.instances = MatchPattern.instances.filter((instance) => !proxy.includes(instance.proxy));
    }
    static merge () {
        let text = [];
        let pac = [];
        MatchPattern.instances.forEach((instance) => {
            if (instance.text && /^(SOCKS5?|HTTPS?) ([^.]+\.)+[^.:]+:\d+$/.test(instance.proxy)) {
                text.push(instance.text);
                pac.push('\n    if (/' + instance.text + '/i.test(host)) {\n        return "' + instance.proxy + '";\n    }');
            }
        });
        let regexp = text.length === 0 ? /!/ : new RegExp('(' + text.join('|') + ')');
        let pac_script = 'function FindProxyForURL(url, host) {' + pac.join('') + '\n    return "DIRECT";\n}';
        return { regexp , pac_script };
    }
};
