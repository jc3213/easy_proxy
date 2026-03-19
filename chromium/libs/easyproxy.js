class EasyProxy {
    static #instances = new Set();
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

    static get pacScript() {
        let rules = [];
        for (let i of EasyProxy.#instances) {
            rules.push(JSON.stringify(i.#routing, null, 4).slice(2, -2));
        }
        return `var RULES = {\n${rules.join(',\n')}\n};\n${EasyProxy.#pasScript}`;
    }

    static make(host) {
        let array = host.split('.');
        if (array.length < 2) {
            return host;
        }
        let sbd = array.at(-3);
        let sld = array.at(-2);
        let tld = array.at(-1);
        return sbd && EasyProxy.#etld.has(sld)
            ? `${sbd}.${sld}.${tld}`
            : `${sld}.${tld}`;
    }

    #rules = new Map();
    #routing = {};

    constructor() {
        EasyProxy.#instances.add(this);
    }

    get rules() {
        return this.#rules;
    }

    get routing() {
        return this.#routing;
    }

    get pacScript() {
        let script = JSON.stringify(this.#routing, null, 4).slice(2, -2);
        return `var RULES = {\n${script}\n};\n${EasyProxy.#pasScript}`;
    }

    getScript(proxy) {
        let rules = this.#rules.get(proxy);
        if (!rules) {
            return 'function FindProxyForURL(url, host) {\n    return "DIRECT";\n}\n';
        }
        let script = [];
        for (let r of rules) {
            script.push(`    "${r}": "${proxy}"`);
        }
        return `var RULES = {\n${script.join('\n')}\n};\n${EasyProxy.#pasScript}`;;
    }

    new(proxy, rules = []) {
        let legacy = this.#rules.get(proxy);
        if (legacy) {
            for (let i of legacy) {
                delete this.#routing[i];
            }
        }
        this.#rules.set(proxy, new Set(rules));
        for (let r of rules) {
            this.#routing[r] = proxy;
        }
        return proxy;
    }

    add(proxy, rule) {
        let find = this.#routing[rule];
        if (find) {
            return find;
        }
        let rules = this.#rules.get(proxy);
        if (rules) {
            rules.add(rule);
        } else {
            this.#rules.set(proxy, new Set([rule]));
        }
        this.#routing[rule] = proxy;
        return proxy;
    }

    delete(proxy, rule) {
        let find = this.#routing[rule];
        if (!find) {
            return false;
        }
        this.#rules.get(proxy).delete(rule);
        return true;
    }

    remove(proxy) {
        let rules = this.#rules.get(proxy);
        if (!rules) {
            return false;
        }
        for (let r of rules) {
            delete this.#routing[r];
        }
        this.#rules.delete(proxy);
        return true;
    }

    destroy() {
        this.#rules = new Map();
        this.#routing = {};
        EasyProxy.#instances.delete(this);
    }

    match(host) {
        while (true) {
            if (this.#routing[host]) {
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
