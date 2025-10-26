importScripts('libs/easyproxy.js', 'background.js');

chrome.runtime.onStartup.addListener(chrome.runtime.getPlatformInfo);

setInterval(chrome.runtime.getPlatformInfo, 28000);
