class MatchPattern {
    constructor () {
        MatchPattern.instances.push(this);
    }
    version = '0.7';
    #data = new Set();
    #text = '';
    #regexp = /!/;
    #pacScript = '';
    #proxy = 'DIRECT';
    get data () {
        return [...this.#data];
    }
    set proxy (proxy) {
        this.#proxy = /^(SOCKS5?|HTTPS?) ([^.]+\.)+[^.:]+:\d+$/.test(proxy) ? proxy : 'DIRECT';
        MatchPattern.pacScript(this);
    }
    get proxy () {
        return this.#proxy;
    }
    get pas_script () {
        return 'function FindProxyForURL(url, host) {\n' + this.#pacScript + '\n    return "DIRECT";\n}'
    }
    add (arg) {
        [arg].flat().forEach((arg) => this.#data.add(arg));
        MatchPattern.update(this);
    }
    remove (arg) {
        [arg].flat().forEach((arg) => this.#data.delete(arg));
        MatchPattern.update(this);
    }
    clear () {
        this.#data.clear();
        this.#text = this.#pacScript = '';
        this.#regexp = /!/;
    }
    test (host) {
        return this.#regexp.test(host);
    }
    static instances = [];
    static caches = new Map();
    static tlds = new Set([
        'aero', 'app', 'arpa', 'asia',
        'biz',
        'cat', 'co', 'com', 'coop',
        'dev',
        'edu', 'eu',
        'gov',
        'info', 'int', 'io',
        'jobs',
        'ltd', 'ltda',
        'mil', 'mobi', 'museum',
        'name', 'ne', 'net',
        'org',
        'post', 'pro',
        'si',
        'tel', 'test', 'travel',
        'web',
        'xxx', 'xyz'
    ]);
    static make (url) {
        let { caches, tlds } = MatchPattern;
        let host = url.match(/^(?:(?:http|ftp|ws)s?:\/\/)?(([^./:]+\.)+[^./:]+)(?::\d+)?\/?/)?.[1];
        if (!host) {
            throw new Error('"' + url + '" is either not a URL, or a valid MatchPattern');
        }
        let rule = caches.get(host);
        if (rule) {
            return {rule, host};
        }
        if (/((25[0-5]|(2[0-4]|1[0-9]|[1-9]?)[0-9])\.){3}(25[0-5]|(2[0-4]|1[0-9]|[1-9])?[0-9])/.test(host)) {
            rule = host.replace(/\d+\.\d+$/, '*');
        } else {
            let [, sbd, sld, tld] = host.match(/(?:([^.]+)\.)?([^.]+)\.([^.]+)$/);
            rule = '*.' + (sbd && tlds.has(sld) ? sbd + '.' : '') + sld + '.' + tld;
        }
        caches.set(url, rule);
        caches.set(host, rule);
        return {rule, host};
    }
    static update (that) {
        let data = that.#data;
        that.#text = data.size === 0 ? '' : data.has('*') ? '.*' : '^(' + [...data].join('|').replace(/\./g, '\\.').replace(/\*\\\./g, '([^.]+\\.)*').replace(/\\\.\*/g, '(\\.[^.]+)*') + ')$';
        that.#regexp = new RegExp(that.#text || '!');
        MatchPattern.pacScript(that);
    }
    static pacScript (that) {
        that.#pacScript = that.#text && that.#proxy !== 'DIRECT' ? '    if (/' + that.#text + '/i.test(host)) {\n        return "' + that.#proxy + '";\n    }' : ''
    }
    static delete (arg) {
        let removed = new Set([arg].flat());
        MatchPattern.instances = MatchPattern.instances.filter((that) => !removed.has(that.proxy));
    }
    static combine () {
        let text = [];
        let pac = [];
        MatchPattern.instances.forEach((that) => {
            if (that.#text && that.#pacScript) {
                text.push(that.#text);
                pac.push(that.#pacScript);
            }
        });
        let regexp = text.length === 0 ? /!/ : new RegExp('(' + text.join('|') + ')');
        let pac_script = 'function FindProxyForURL(url, host) {\n' + pac.join('\n') + '\n    return "DIRECT";\n}';
        return { regexp , pac_script };
    }
};
