class MatchPattern {
    constructor () {
        MatchPattern.#instances.push(this);
    }
    version = '1.0';
    #data = new Set();
    #dataSet = [];
    #global = false;
    #pacScript = '';
    #proxy = 'DIRECT';
    get data () {
        return this.#dataSet;
    }
    set proxy (proxy) {
        this.#proxy = /^(SOCKS5?|HTTPS?) ([^.]+\.)+[^.:]+(:\d{2,5})?$/.test(proxy) ? proxy : 'DIRECT';
        this.#build();
    }
    get proxy () {
        return this.#proxy;
    }
    get pacScript () {
        return `function FindProxyForURL(url, host) {\n${this.#pacScript}\n    return "DIRECT";\n}`;
    }
    new (arg) {
        this.#data = new Set(Array.isArray(arg) ? arg : [arg]);
        this.#update();
    }
    add (arg) {
        Array.isArray(arg) ? arg.forEach((i) => this.#data.add(i)) : this.#data.add(arg);
        this.#update();
    }
    delete (arg) {
        Array.isArray(arg) ? arg.forEach((i) => this.#data.delete(i)) : this.#data.delete(arg);
        this.#update();
    }
    clear () {
        this.#data.clear();
        this.#global = false;
        this.#dataSet = [];
        this.#pacScript = '';
    }
    test (host) {
        return this.#global || this.#data.has(host) || this.#dataSet.some((i) => host.endsWith(`.${i}`));
    }
    #update () {
        this.#global = this.#data.has('*');
        this.#dataSet = [...this.#data];
        this.#build();
    }
    #build () {
        this.#pacScript = this.#data.size === 0 || this.#proxy === 'DIRECT' ? ''
            : this.#data.has('*') ? `    return "${this.#proxy};"`
            : this.#dataSet.map((i) => `    if (dnsDomainIs(host, "${i}")) {\n        return "${this.#proxy}";\n    }`).join('\n');
    }
    static #instances = [];
    static #tlds = new Set([
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
    static #caches = new Map();
    static get caches () {
        return MatchPattern.#caches;
    }
    static make (host) {
        let rule = MatchPattern.#caches.get(host);
        if (rule) {
            return rule;
        }
        let [, sbd, sld, tld] = host.match(/(?:([^.]+)\.)?([^.]+)\.([^.]+)$/);
        rule = sbd && MatchPattern.#tlds.has(sld) ? `${sbd}.${sld}.${tld}` : `${sld}.${tld}`;
        MatchPattern.#caches.set(host, rule);
        return rule;
    }
    static test (host) {
        return MatchPattern.#instances.some((that) => that.#proxy !== 'DIRECT' && that.test(host));
    }
    static delete (arg) {
        let removed = new Set(Array.isArray(arg) ? arg : [arg]);
        MatchPattern.#instances = MatchPattern.#instances.filter((that) => !removed.has(that.proxy));
    }
    static get pacScript () {
        let pac = MatchPattern.#instances.map((that) => that.#pacScript).join('\n');
        return `function FindProxyForURL(url, host) {${pac}\n    return "DIRECT";\n}`;
    }
}
