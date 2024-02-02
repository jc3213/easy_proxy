importScripts('/libs/converter.js');

var easyDefault = {
    proxies: []
};

function setNewProxy(data) {
    chrome.proxy.settings.set({
        value: {
            mode: "pac_script",
            pacScript: {data}
        },
        scope: 'regular'
    }, () => {
        console.log(data);
    });
}

chrome.storage.sync.get(null, (json) => {
    easyStorage = {...easyDefault, ...json};
    setNewProxy(convertRules(easyStorage));
})

chrome.storage.onChanged.addListener((changes) => {
    Object.keys(changes).forEach((key) => {
        var {newValue} = changes[key];
        if (newValue === undefined) {
            easyStorage.proxies.splice(easyStorage.proxies.indexOf(key), 1);
            delete easyStorage[key];
            return;
        }
        easyStorage[key] = newValue;
    });
    setNewProxy(convertRules(easyStorage));
});
