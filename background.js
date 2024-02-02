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

chrome.runtime.onMessage.addListener(setNewProxy);

chrome.action.onClicked.addListener((tab) => {
    chrome.runtime.openOptionsPage();
});

chrome.webRequest.onErrorOccurred.addListener((details) => {
    var {host} = new URL(details.url);
    console.log(`Error occurred: ${host}\n${details.error}`);
}, {urls: ["http://*/*", "https://*/*"]});

chrome.storage.sync.get(null, (json) => {
    easyStorage = {...easyDefault, ...json};
    setNewProxy(convertJsonToPAC(easyStorage));
});
