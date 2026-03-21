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
            let proxy = i.#routing['*'];
            if (proxy) {
                return `function FindProxyForURL(url, host) {\n    return "${proxy}";\n}\n`;
            }
            let rule = JSON.stringify(i.#routing, null, 4).slice(2, -2);
            if (rule) {
                rules.push(rule);
            }
        }
        return rules.length > 0
            ? `var RULES = {\n${rules.join(',\n')}\n};\n${EasyProxy.#pasScript}`
            : 'function FindProxyForURL(url, host) {\n    return "DIRECT";\n}\n';
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

    get routing() {
        return this.#routing;
    }

    get pacScript() {
        let proxy = this.#routing['*'];
        if (proxy) {
            return `function FindProxyForURL(url, host) {\n    return "${proxy}";\n}\n`;
        }
        let script = JSON.stringify(this.#routing, null, 4).slice(2, -2);
        return script
            ? `var RULES = {\n${script}\n};\n${EasyProxy.#pasScript}`
            : 'function FindProxyForURL(url, host) {\n    return "DIRECT";\n}\n';
    }

    getScript(proxy) {
        let rules = this.#rules.get(proxy);
        if (!rules || rules.size === 0) {
            return 'function FindProxyForURL(url, host) {\n    return "DIRECT";\n}\n';
        }
        if (rules.has('*')) {
            return `function FindProxyForURL(url, host) {\n    return "${proxy}";\n}\n`;
        }
        let script = [];
        for (let r of rules) {
            script.push(`    "${r}": "${proxy}"`);
        }
        return `var RULES = {\n${script.join(',\n')}\n};\n${EasyProxy.#pasScript}`;;
    }

    getRules(proxy) {
        return [...this.#rules.get(proxy)];
    }

    new(proxy, rules) {
        let prev = this.#rules.get(proxy);
        if (prev) {
            for (let i of prev) {
                delete this.#routing[i];
            }
        }
        let next = new Set(rules);
        this.#rules.set(proxy, next);
        for (let r of next) {
            this.#routing[r] = proxy;
        }
        return true;
    }

    add(proxy, rule) {
        let find = this.#routing[rule];
        if (find) {
            return false;
        }
        let rules = this.#rules.get(proxy);
        if (rules) {
            rules.add(rule);
        } else {
            this.#rules.set(proxy, new Set([rule]));
        }
        this.#routing[rule] = proxy;
        return true;
    }

    delete(proxy, rule) {
        let find = this.#routing[rule];
        if (!find) {
            return false;
        }
        this.#rules.get(proxy).delete(rule);
        delete this.#routing[rule];
        return true;
    }

    remove(proxy) {
        let rules = this.#rules.get(proxy);
        if (!rules) {
            return false;
        }
        this.#rules.delete(proxy);
        for (let r of rules) {
            delete this.#routing[r];
        }
        return true;
    }

    destroy() {
        this.#rules = new Map();
        this.#routing = {};
        EasyProxy.#instances.delete(this);
        return true;
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
