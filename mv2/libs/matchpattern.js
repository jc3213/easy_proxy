(() => {
    const cache = {};

    const ipv4 = (hostname) => {
        return /((25[0-5]|(2[0-4]|1[0-9]|[1-9]?)[0-9])\.){3}(25[0-5]|(2[0-4]|1[0-9]|[1-9])?[0-9])/.test(hostname);
    };

    const make = (hostname) => {
        if (ipv4(hostname)) {
            return hostname.replace(/\d+\.\d+$/, '*');
        }

        return hostname.replace(/^([^\.]+\.)*([^\.]+\.[^\.]+)$/, '*.$2');
    };

    const host = (hostname) => {
        return cache[hostname] ??= make(hostname);
    };
    
    const url = (url) => {
        return host(new URL(url).hostname);
    };
    
    self.MatchPattern = {url, host};
})();
