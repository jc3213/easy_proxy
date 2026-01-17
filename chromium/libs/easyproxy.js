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
    #rules = {};
    #empty = true;
    #global = false;
    #proxy;
    #pacScript;

    constructor(string) {
        if (!/^(DIRECT|BLOCK|(HTTPS?|SOCKS5?) [A-Za-z0-9.-]+:\d{1,5})$/.test(string)) {
            throw new TypeError('Invalid proxy handler: excpeted "PROXY_TYPE HOST:PORT"');
        }
        this.#proxy = string;
        EasyProxy.#instances.push(this);
    }

    get rules() {
        return this.#rules;
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
        let temp = host.split('.');
        if (temp.length < 2) {
            return host;
        }
        let sbd = temp.at(-3);
        let sld = temp.at(-2);
        let tld = temp.at(-1);
        return sbd && EasyProxy.#etld.has(sld)
            ? `${sbd}.${sld}.${tld}`
            : `${sld}.${tld}`;
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
        let del = new Set(Array.isArray(arg) ? arg : [arg]);
        let arr = [];
        for (let i of EasyProxy.#instances) {
            if (!del.has(i.#proxy)) {
                arr.push(i);
            }
        }
        EasyProxy.#instances = arr;
    }

    #sync() {
        this.#empty = Object.keys(this.#rules).length === 0;
        this.#global = '*' in this.#rules;
        this.#make();
    }

    #make() {
        this.#pacScript = JSON.stringify(this.#rules, null, 4).slice(2, -2);
    }

    new(arg) {
        this.#rules = {};
        this.add(arg);
    }

    add(arg) {
        let add = Array.isArray(arg) ? arg : typeof arg === 'string' ? [arg] : [];
        for (let i of add) {
            this.#rules[i] = this.#proxy;
        }
        this.#sync();
    }

    delete(arg) {
        let del = Array.isArray(arg) ? arg : typeof arg === 'string' ? [arg] : [];
        for (let i of del) {
            delete this.#rules[i];
        }
        this.#sync();
    }

    test(host) {
        if (this.#empty) {
            return false;
        }
        if (this.#global) {
            return true;
        }
        while (true) {
            if (this.#rules[host]) {
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
