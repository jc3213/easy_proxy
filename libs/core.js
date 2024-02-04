var easyPAC;
var easyStorage;
var easyDefault = {
    proxies: [],
    fallback: null
};

async function init(callback) {
    var json = await chrome.storage.sync.get(null);
    easyStorage = {...easyDefault, ...json};
    easyPAC = convertJsonToPAC(easyStorage);
    callback(easyStorage, easyPAC);
}

function convertJsonToPAC(json, fallback, pacscript = '') {
    json.proxies.forEach((proxy) => {
        if (json[proxy] !== '') {
            var regexp = convertRegexp(json[proxy]);
            pacscript += ` if (/${regexp}/i.test(host)) { return "${proxy}"; }`;
        }
    });
    if (fallback) {
        pacscript += ` if (/^(${convertRegexp(fallback)})$/.test(host)) { return "${json.fallback}"; }`
    }
    return `function FindProxyForURL(url, host) {${pacscript} return "DIRECT"; }`;
}

function convertRegexp(string) {
    return string.replace(/[\s;\n]+/g, '|').replace(/\./g, '\\.').replace(/\*\\\./g, '.*');
}
