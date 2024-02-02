function convertJsonToPAC(json) {
    var pacscript = '';
    json.proxies.forEach((proxy) => {
        var regexp = `^(${json[proxy].replace(/[\s;\n]/g, '|').replace(/\./g, '\\.').replace(/\*/g, '.*')})$`;
        pacscript += ` if (/${regexp}/i.test(host)) { return "${proxy}"; }`;
    });
    return `function FindProxyForURL(url, host) {${pacscript} return "DIRECT"; }`;
}
