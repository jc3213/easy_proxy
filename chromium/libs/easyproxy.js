class EasyProxy {
    #set = new Set();
    #data = [];
    #test = [];
    #empty = true;
    #global = false;
    #proxy;
    #pacScript;

    constructor(string) {
        this.proxy = string ?? 'DIRECT';
        EasyProxy.#instances.push(this);
    }

    get data() {
        return this.#data;
    }

    set proxy(string) {
        if (string !== 'DIRECT' && !/^(SOCKS5?|HTTPS?) ([^.]+\.)+[^.:]+(:\d{2,5})?$/.test(string)) {
            throw new TypeError('Invalid proxy: expected "DIRECT" or a valid proxy (e.g., "HTTP 123.0.1.1:8080").');
        }
        this.#proxy = string;
        this.#build();
    }
    get proxy() {
        return this.#proxy;
    }

    get pacScript() {
        return `function FindProxyForURL(url, host) {\n${this.#pacScript}\n${this.#global ? '' : '    return "DIRECT";\n'}}`;
    }

    #update() {
        this.#data = [...this.#set];
        this.#test = this.#data.map((i) => `.${i}`);
        this.#empty = this.#data.length === 0;
        this.#global = this.#set.has('*');
        this.#build();
    }
    #build() {
        this.#pacScript = this.#empty ? ''
            : this.#global ? `    return "${this.#proxy};"`
            : `    if (${[...this.#data].map((i) => `dnsDomainIs(host, "${i}")`).join(' ||\n        ')}) {\n        return "${this.#proxy}";\n    }`;
    }

    new(arg) {
        this.#set = new Set(Array.isArray(arg) ? arg : [arg]);
        this.#update();
    }
    add(arg) {
        Array.isArray(arg) ? arg.forEach((i) => this.#set.add(i)) : this.#set.add(arg);
        this.#update();
    }
    delete(arg) {
        Array.isArray(arg) ? arg.forEach((i) => this.#set.delete(i)) : this.#set.delete(arg);
        this.#update();
    }
    clear() {
        this.#set = new Set();
        this.#data = [];
        this.#test = [];
        this.#empty = true;
        this.#global = false;
        this.#pacScript = '';
    }
    test(string) {
        return !this.#empty && (this.#global || this.#set.has(string) || this.#test.some((i) => string.endsWith(i)));
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

    static get caches() {
        return EasyProxy.#caches;
    }

    static get pacScript() {
        let pacScript = EasyProxy.#instances.map((i) => i.#pacScript).join('\n');
        return `function FindProxyForURL(url, host) {${pacScript}\n    return "DIRECT";\n}`;
    }

    static make(string) {
        let rule = EasyProxy.#caches.get(string);
        if (rule) {
            return rule;
        }
        let [, sbd, sld, tld] = string.match(/(?:([^.]+)\.)?([^.]+)\.([^.]+)$/);
        rule = sbd && EasyProxy.#tlds.has(sld) ? `${sbd}.${sld}.${tld}` : `${sld}.${tld}`;
        EasyProxy.#caches.set(string, rule);
        return rule;
    }
    static test(string) {
        return EasyProxy.#instances.some((i) => i.#proxy !== 'DIRECT' && i.test(string));
    }
    static delete(arg) {
        let remove = Array.isArray(arg) ? arg : [arg];
        EasyProxy.#instances = EasyProxy.#instances.filter((i) => !remove.includes(i.#proxy));
    }
}
