class EasyProxy {
    constructor () {
        EasyProxy.#instances.push(this);
    }
    version = '1.0';
    #set = new Set();
    #data = [];
    #test = [];
    #empty = true;
    #global = false;
    #pacScript = '';
    #proxy = 'DIRECT';
    get data () {
        return this.#data;
    }
    set proxy (string) {
        this.#proxy = /^(SOCKS5?|HTTPS?) ([^.]+\.)+[^.:]+(:\d{2,5})?$/.test(string) ? string : 'DIRECT';
        this.#build();
    }
    get proxy () {
        return this.#proxy;
    }
    get pacScript () {
        return `function FindProxyForURL(url, host) {\n${this.#pacScript}\n${this.#global ? '' : '    return "DIRECT";\n'}}`;
    }
    new (arg) {
        this.#set = new Set(Array.isArray(arg) ? arg : [arg]);
        this.#update();
    }
    add (arg) {
        Array.isArray(arg) ? arg.forEach((i) => this.#set.add(i)) : this.#set.add(arg);
        this.#update();
    }
    delete (arg) {
        Array.isArray(arg) ? arg.forEach((i) => this.#set.delete(i)) : this.#set.delete(arg);
        this.#update();
    }
    clear () {
        this.#set.clear();
        this.#data = [];
        this.#test = [];
        this.#empty = true;
        this.#global = false;
        this.#pacScript = '';
    }
    test (string) {
        return this.#global || this.#set.has(string) || this.#test.some((i) => string.endsWith(i));
    }
    #update () {
        this.#data = [...this.#set];
        this.#test = this.#data.map((i) => `.${i}`);
        this.#empty = this.#data.length === 0;
        this.#global = this.#set.has('*');
        this.#build();
    }
    #build () {
        this.#pacScript = this.#empty || this.#proxy === 'DIRECT' ? ''
            : this.#global ? `    return "${this.#proxy};"`
            : `    if (${[...this.#data].map(i => `dnsDomainIs(host, "${i}")`).join(' ||\n        ')}) {\n        return "${this.#proxy}";\n    }`;
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
        return EasyProxy.#caches;
    }
    static make (string) {
        let rule = EasyProxy.#caches.get(string);
        if (rule) {
            return rule;
        }
        let [, sbd, sld, tld] = string.match(/(?:([^.]+)\.)?([^.]+)\.([^.]+)$/);
        rule = sbd && EasyProxy.#tlds.has(sld) ? `${sbd}.${sld}.${tld}` : `${sld}.${tld}`;
        EasyProxy.#caches.set(string, rule);
        return rule;
    }
    static test (string) {
        return EasyProxy.#instances.some((that) => that.#proxy !== 'DIRECT' && that.test(string));
    }
    static delete (arg) {
        let remove = new Set(Array.isArray(arg) ? arg : [arg]);
        EasyProxy.#instances = EasyProxy.#instances.filter((that) => !remove.has(that.proxy));
    }
    static get pacScript () {
        let pac = EasyProxy.#instances.map((that) => that.#pacScript).join('\n');
        return `function FindProxyForURL(url, host) {${pac}\n    return "DIRECT";\n}`;
    }
}
