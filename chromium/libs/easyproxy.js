class EasyProxy {
    static #instances = new Set();
    static #etld = new Set([ 'ac', 'co', 'com', 'edu', 'go', 'gov', 'ne', 'net', 'or', 'org', 'sch' ]);
    static #pacScript = `
function FindProxyForURL(url, host) {
    for (;;) {
        var proxy = RULES[host];

        if (proxy) {
            return proxy;
        }

        var dot = host.indexOf(".");

        if (dot < 0) {
            return "DIRECT";
        }

        host = host.substring(dot + 1);
    }
}
`;

    static getScript(instances) {
        let proxies = [];
        let scripts = [];

        for (let i of instances) {
            let global = i.#routing['*'];

            if (global) {
                return 'function FindProxyForURL(url, host) {\n    return "' + global + '";\n}\n';
            }

            for (let entries of i.#ruleMap) {
                let proxy = entries[0];
                let rules = entries[1];

                if (rules.size === 0) {
                    continue;
                }

                let id;

                if (proxy === 'DIRECT') {
                    id = '"DIRECT"';
                } else {
                    id = 'PROXY' + proxies.length;
                    proxies.push('var ' + id + ' = "' + proxy + '";');
                }

                for (let r of rules) {
                    scripts.push('    "' + r + '": ' + id);
                }
            }
        }

        if (proxies.length === 0) {
            return 'function FindProxyForURL(url, host) {\n    return "DIRECT";\n}\n';
        }

        return proxies.join('\n') + '\n\nvar RULES = {\n' + scripts.join(',\n') + '\n};\n' + EasyProxy.#pacScript;
    }

    static get pacScript() {
        return EasyProxy.getScript(EasyProxy.#instances);
    }

    static makeRule(host) {
        let array = host.split('.');

        if (array.length < 2) {
            return host;
        }

        let sbd = array.at(-3);
        let sld = array.at(-2);
        let tld = array.at(-1);

        if (sbd && EasyProxy.#etld.has(sld)) {
            return sbd + '.' + sld + '.' +tld;
        }

        return sld + '.' +tld;
    }

    #ruleMap = new Map();
    #routing = {};

    constructor() {
        EasyProxy.#instances.add(this);
    }

    get routing() {
        return this.#routing;
    }

    get pacScript() {
        return EasyProxy.getScript([this]);
    }

    getScript(proxy) {
        let rules = this.#ruleMap.get(proxy);

        if (!rules || rules.size === 0) {
            return 'function FindProxyForURL(url, host) {\n    return "DIRECT";\n}\n';
        }

        if (rules.has('*')) {
            return 'function FindProxyForURL(url, host) {\n    return "' + proxy + '";\n}\n';
        }

        let scripts = [];

        for (let r of rules) {
            scripts.push('    "' + r + '": PROXY');
        }

        return 'var PROXY = "' + proxy + '";\n\nvar RULES = {\n' + scripts.join(',\n') + '\n};\n' + EasyProxy.#pacScript;
    }

    addProxy(proxy, rules) {
        let ruleMap = this.#ruleMap;
        let routing = this.#routing;
        let prev = ruleMap.get(proxy);

        if (prev) {
            for (let i of prev) {
                delete routing[i];
            }
        }

        if (!Array.isArray(rules)) {
            ruleMap.set(proxy, new Set());
            return true;
        }

        let next = new Set(rules);

        for (let r of next) {
            routing[r] = proxy;
        }

        ruleMap.set(proxy, next);
        return true;
    }

    removeProxy(proxy) {
        let ruleMap = this.#ruleMap;
        let rules = ruleMap.get(proxy);

        if (!rules) {
            return false;
        }

        let routing = this.#routing;

        for (let r of rules) {
            delete routing[r];
        }

        ruleMap.delete(proxy);
        return true;
    }

    hasProxy(proxy) {
        return this.#ruleMap.has(proxy);
    }

    findProxy(host) {
        let routing = this.#routing;

        for (;;) {
            let proxy = routing[host];

            if (proxy) {
                return proxy;
            }

            let dot = host.indexOf('.');

            if (dot < 0) {
                return;
            }

            host = host.substring(dot + 1);
        }
    }

    listProxies() {
        return Array.from(this.#ruleMap.keys());
    }

    addRule(proxy, rule) {
        let routing = this.#routing;
        let find = routing[rule];

        if (find) {
            return false;
        }

        let ruleMap = this.#ruleMap;
        let rules = ruleMap.get(proxy);

        if (rules) {
            rules.add(rule);
        } else {
            ruleMap.set(proxy, new Set([rule]));
        }

        routing[rule] = proxy;
        return true;
    }

    removeRule(proxy, rule) {
        let routing = this.#routing;
        let find = routing[rule];

        if (!find || find !== proxy) {
            return false;
        }

        this.#ruleMap.get(proxy).delete(rule);
        delete routing[rule];
        return true;
    }

    hasRule(rule) {
        return rule in this.#routing;
    }

    getRules(proxy) {
        let ruleMap = this.#ruleMap;
        let rules = ruleMap.get(proxy);

        if (rules) {
            return Array.from(rules);
        }

        if (proxy !== null && proxy !== undefined) {
            return;
        }

        let result = {};

        for (let entries of ruleMap) {
            let proxy = entries[0];
            let rules = entries[1];
            result[proxy] = Array.from(rules);
        }

        return result;
    }

    clearRules(proxy) {
        let ruleMap = this.#ruleMap;
        let routing = this.#routing;
        let rules = ruleMap.get(proxy);

        if (rules) {
            for (let r of rules) {
                delete routing[r];
            }

            ruleMap.set(proxy, new Set());
            return true;
        }

        if (proxy !== null && proxy !== undefined) {
            return false;
        }

        for (let k of ruleMap.keys()) {
            ruleMap.set(k, new Set());
        }

        this.#routing = {};
        return true;
    }

    listRules() {
        let rules = [];

        for (let r of this.#ruleMap.values()) {
            rules.push(Array.from(r));
        }

        return rules;
    }

    destroy() {
        this.#ruleMap = new Map();
        this.#routing = {};
        EasyProxy.#instances.delete(this);
        return true;
    }
}
