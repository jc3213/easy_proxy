class Storage {
    constructor (database, store) {
        if (!database || typeof database !== 'string') {
            throw new TypeError('parameter 1 must be a non-empty string!');
        }
        if (!store || typeof store !== 'string') {
            throw new TypeError('parameter 2 must be a non-empty string!');
        }
        this.#database = database;
        this.#store = store;
        this.open();
    }
    version = '0.1';
    #database;
    #store;
    #db;
    #transaction (callback) {
        return new Promise(async (resolve, reject) => {
            let db = await this.#db;
            let transaction = db.transaction(this.#store, 'readwrite');
            let store = transaction.objectStore(this.#store);
            let request = callback(store);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    open () {
        this.#db = new Promise((resolve, reject) => {
            let request = indexedDB.open(this.#database, 1);
            request.onsuccess = () => resolve(request.result);
            request.onupgradeneeded = (event) => request.result.createObjectStore(this.#store, { keyPath: 'key' });
            request.onerror = () => reject(request.error);
        });
    }
    close () {
        return this.#db.then((db) => db.close());
    }
    set (key, value) {
        return this.#transaction((store) => store.put({ key, value }));
    }
    has (key) {
        return this.#transaction((store) => store.get(key)).then((item) => item !== undefined);
    }
    get (key) {
        return this.#transaction((store) => store.get(key)).then((item) => item?.value);
    }
    delete (key) {
        return this.#transaction((store) => store.delete(key));
    }
    entries () {
        return this.#transaction((store) => store.getAll());
    }
    keys () {
        return this.#transaction((store) => store.getAllKeys());
    }
    values () {
        return this.entries().then((entries) => entries.map((item) => item.value));
    }
    forEach (callback) {
        return this.entries().then((entries) => entries.forEach(callback));
    }
    clear () {
        return this.#transaction((store) => store.clear());
    }
    flush () {
        return new Promise(async (resolve, reject) => {
            await this.close();
            let request = indexedDB.deleteDatabase(this.#database);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
}
