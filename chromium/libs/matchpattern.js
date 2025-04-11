class MatchPattern {
    constructor () {
        this.proxy = 'DIRECT';
        this.clear();
        MatchPattern.instances.add(this);
    }
    version = '0.5';
    add (...args) {
        args.flat().forEach((arg) => this.data.add(MatchPattern.make(arg)));
        this.list = [...this.data];
        this.text = MatchPattern.stringnify(this.data);
        this.regexp = new RegExp(this.text);
    }
    remove (...args) {
        args.flat().forEach((arg) => this.data.delete(arg));
        this.list = [...this.data];
        this.text = MatchPattern.stringnify(this.data);
        this.regexp = new RegExp(this.text);
    }
    clear () {
        this.data = new Set();
        this.list = [];
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
    static instances = new Set();
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
        let {caches, tlds} = MatchPattern;
        let result = caches[string];
        if (result) {
            return result;
        }
        let host = string.match(/^(?:https?|ftps?|wss?)?:?(?:\/\/)?((?:[^./:]+\.)+[^./:]+):?(?:\d+)?\/?(?:[^\/]+\/?)*$/)?.[1];
        if (!host) {
            throw new Error('"' + string + '" is either not a URL, or a valid MatchPattern');
        }
        result = caches[host];
        if (result) {
            return result;
        }
        if (/((25[0-5]|(2[0-4]|1[0-9]|[1-9]?)[0-9])\.){3}(25[0-5]|(2[0-4]|1[0-9]|[1-9])?[0-9])/.test(host)) {
            return caches[string] = caches[host] = host.replace(/\d+\.\d+$/, '*');
        }
        let [_, sbd, sld, tld] = host.match(/(?:([^.]+)\.)?([^.]+)\.([^.]+)$/);
        return caches[string] = caches[host] = '*.' + (sbd && tlds[sld] ? sbd + '.' : '') + sld + '.' + tld;
    }
    static stringnify (set) {
        if (set.size === 0) {
            return '';
        }
        if (set.has('*')) {
            return '.*';
        }
        return '^(' + [...set].join('|').replace(/\./g, '\\.').replace(/\*\\\./g, '([^.]+\\.)*').replace(/\\\.\*/g, '(\\.[^.]+)*') + ')$';
    }
    static erase (...args) {
        args.flat().forEach((instance) => MatchPattern.instances.delete(instance));
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
