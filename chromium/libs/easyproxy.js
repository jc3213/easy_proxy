class EasyProxy {
    static #instances = [];
    static #etld = new Set([ 'ac', 'co', 'com', 'edu', 'go', 'gov', 'ne', 'net', 'or', 'org', 'sch' ]);
    static #pacBody = `
function FindProxyForURL(url, host) {
    var src = host;
    while (true) {
        var hit = RULES[src];
        if (hit) {
            RULES[host] = hit;
            return hit;
        }
        var dot = src.indexOf(".");
        if (dot < 0) {
            return "DIRECT";
        }
        src = src.substring(dot + 1);
    }
}
`;
    #data = new Set();
    #empty = true;
    #global = false;
    #proxy;
    #rules;

    constructor(string) {
        this.proxy = string ?? 'DIRECT';
        EasyProxy.#instances.push(this);
    }

    get data() {
        return [...this.#data];
    }

    set proxy(string) {
        this.#proxy = string;
        this.#make();
    }
    get proxy() {
        return this.#proxy;
    }

    get pacScript() {
        return this.#empty
            ? 'function FindProxyForURL(url, host) {\n    return "DIRECT";\n}'
            : this.#global
            ? `function FindProxyForURL(url, host) {\n    return "${this.#proxy}";\n}`
            : `var RULES = ${JSON.stringify(this.#rules, null, 4)};\n${EasyProxy.#pacBody}`;
    }

    static get pacScript() {
        let rules = {};
        for (let i of EasyProxy.#instances) {
            if (i.#empty) {
                continue;
            }
            if (i.#global) {
                return `function FindProxyForURL(url, host) {\n    return "${i.#proxy}";\n}`;
            }
            Object.assign(rules, i.#rules);
        }
        return rules.length === 0
            ? 'function FindProxyForURL(url, host) {\n    return "DIRECT";\n}'
            : `var RULES = ${JSON.stringify(rules, null, 4)};\n${EasyProxy.#pacBody}`;
    }

    static make(host) {
        let temp = host.split('.');
        if (temp.length < 2) {
            return host;
        }
        let sbd = temp.at(-3);
        let sld = temp.at(-2);
        let tld = temp.at(-1);
        return sbd && EasyProxy.#etld.has(sld) ? `${sbd}.${sld}.${tld}` : `${sld}.${tld}`;
    }

    static test(host) {
        for (let i of EasyProxy.#instances) {
            if (i.#proxy !== 'DIRECT' && i.test(host)) {
                return true;
            }
        }
        return false;
    }

    static delete(arg) {
        let remove = new Set(Array.isArray(arg) ? arg : [arg]);
        let result = [];
        for (let i of EasyProxy.#instances) {
            if (!remove.has(i.#proxy)) {
                result.push(i);
            }
        }
        EasyProxy.#instances = result;
    }

    #sync() {
        this.#empty = this.#data.size === 0;
        this.#global = this.#data.has('*');
        this.#make();
    }

    #make() {
        if (this.#empty) {
            return;
        }
        let rules = {};
        for (let i of this.#data) {
            rules[i] = this.#proxy;
        }
        this.#rules = rules;
    }

    new(arg) {
        this.#data = new Set();
        this.add(arg);
    }

    add(arg) {
        if (Array.isArray(arg)) {
            for (let i of arg) {
                this.#data.add(i);
            }
        } else {
            this.#data.add(arg);
        }
        this.#sync();
    }

    delete(arg) {
        if (Array.isArray(arg)) {
            for (let i of arg) {
                this.#data.delete(i);
            }
        } else {
            this.#data.delete(arg);
        }
        this.#sync();
    }

    clear() {
        this.#data = new Set();
        this.#empty = true;
        this.#global = false;
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
                return false;
            }
            host = host.substring(dot + 1);
        }
    }
}
