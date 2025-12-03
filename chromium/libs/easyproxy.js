class EasyProxy {
    static #instances = [];
    static #caches = {};
    static #etld = new Set([ 'ac', 'co', 'com', 'edu', 'go', 'gov', 'ne', 'net', 'or', 'org', 'sch' ]);
    static #pacBody = `
function FindProxyForURL(url, host) {
    var src = host;
    while (true) {
        var hit = RULES[host];
        if (hit) {
            RULES[src] = hit;
            return hit;
        }
        var dot = host.indexOf(".");
        if (dot < 0) {
            break;
        }
        host = host.substring(dot + 1);
    }
    return "DIRECT";
}
`;
    #data = new Set();
    #empty = true;
    #global = false;
    #proxy;
    #pacScript;

    constructor(string) {
        this.proxy = string ?? 'DIRECT';
        EasyProxy.#instances.push(this);
    }

    get data() {
        return [...this.#data];
    }

    set proxy(string) {
        this.#proxy = string;
        this.#build();
    }
    get proxy() {
        return this.#proxy;
    }

    get pacScript() {
        return this.#empty
            ? 'function FindProxyForURL(url, host) {\n    return "DIRECT";\n}'
            : this.#global
            ? `function FindProxyForURL(url, host) {\n    return "${this.#proxy}";\n}`
            : `var RULES = {\n${this.#pacScript}\n};\n${EasyProxy.#pacBody}`;
    }

    static get caches() {
        return EasyProxy.#caches;
    }

    static get pacScript() {
        let rules = [];
        for (let i of EasyProxy.#instances) {
            if (i.#empty) {
                continue;
            }
            if (i.#global) {
                return `function FindProxyForURL(url, host) {\n    return "${i.#proxy}";\n}`;
            }
            rules.unshift(i.#pacScript);
        }
        return rules.length === 0
            ? 'function FindProxyForURL(url, host) {\n    return "DIRECT";\n}'
            : `var RULES = {\n${rules.join(',\n')}\n};\n${EasyProxy.#pacBody}`;
    }

    static make(host) {
        let rule = EasyProxy.#caches[host];
        if (rule) {
            return rule;
        }
        let temp = host.split('.');
        if (temp.length < 2) {
            rule = host;
        } else {
            let sbd = temp.at(-3);
            let sld = temp.at(-2);
            let tld = temp.at(-1);
            rule = sbd && EasyProxy.#etld.has(sld) ? `${sbd}.${sld}.${tld}` : `${sld}.${tld}`;
        }
        EasyProxy.#caches[host] = rule;
        return rule;
    }

    static test(host) {
        return EasyProxy.#instances.some((i) => i.#proxy !== 'DIRECT' && i.test(host));
    }

    static delete(arg) {
        let remove = Array.isArray(arg) ? arg : [arg];
        EasyProxy.#instances = EasyProxy.#instances.filter((i) => !remove.includes(i.#proxy));
    }

    #update() {
        this.#empty = this.#data.size === 0;
        this.#global = this.#data.has('*');
        this.#build();
    }

    #build() {
        if (!this.#empty) {
            this.#pacScript = this.data.map((i) => `    "${i}": "${this.#proxy}"`).join(',\n');
        }
    }

    new(arg) {
        this.#data = new Set(Array.isArray(arg) ? arg : [arg]);
        this.#update();
    }

    add(arg) {
        Array.isArray(arg) ? arg.forEach((i) => this.#data.add(i)) : this.#data.add(arg);
        this.#update();
    }

    delete(arg) {
        Array.isArray(arg) ? arg.forEach((i) => this.#data.delete(i)) : this.#data.delete(arg);
        this.#update();
    }

    clear() {
        this.#data = new Set();
        this.#empty = true;
        this.#global = false;
        this.#pacScript = '';
    }

    test(host) {
        if (this.#empty) {
            return false;
        }
        if (this.#global) {
            return true;
        }
        while (true) {
            if (this.#data.has(host)) {
                return true;
            }
            let dot = host.indexOf('.');
            if (dot < 0) {
                break;
            }
            host = host.substring(dot + 1);
        }
        return false;
    }
}
