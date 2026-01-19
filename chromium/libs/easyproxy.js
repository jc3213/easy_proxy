class EasyProxy {
    static #instances = [];
    static #etld = new Set([ 'ac', 'co', 'com', 'edu', 'go', 'gov', 'ne', 'net', 'or', 'org', 'sch' ]);
    static #pasScript = `
function FindProxyForURL(url, host) {
    while (true) {
        var hit = RULES[host];
        if (hit) {
            return hit;
        }
        var dot = host.indexOf(".");
        if (dot < 0) {
            return "DIRECT";
        }
        host = host.substring(dot + 1);
    }
}
`;

    #id;
    #proxy;
    #script;
    #rules = {};
    #empty = true;
    #global = false;

    constructor(string) {
        if (!/^(DIRECT|BLOCK|(HTTPS?|SOCKS5?) [A-Za-z0-9.-]+:\d{1,5})$/.test(string)) {
            throw new TypeError('Invalid proxy handler: excpeted "PROXY_TYPE HOST:PORT"');
        }
        let i = EasyProxy.#instances;
        this.#id = `PROXY${i.length}`;
        this.#proxy = string;
        i.push(this);
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
            : `var ${this.#id} = "${this.#proxy}";\n\nvar RULES = {\n${this.#script}\n};\n${EasyProxy.#pasScript}`;
    }

    static get pacScript() {
        let ids = [];
        let rules = [];
        for (let i of EasyProxy.#instances) {
            if (i.#empty) {
                continue;
            }
            if (i.#global) {
                return `function FindProxyForURL(url, host) {\n    return "${i.#proxy}";\n}`;
            }
            ids.push(`var ${i.#id} = "${i.#proxy}";`);
            rules.unshift(i.#script);
        }
        return rules.length === 0
            ? 'function FindProxyForURL(url, host) {\n    return "DIRECT";\n}'
            : `${ids.join('\n')}\n\nvar RULES = {\n${rules.join(',\n')}\n};\n${EasyProxy.#pasScript}`;
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
        this.#script = JSON.stringify(this.#rules, null, 4).slice(2, -2).replaceAll(`"${this.#proxy}"`, this.#id);
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
