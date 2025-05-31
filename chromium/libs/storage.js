class Storage {
    constructor (dbase, store) {
        if (!dbase || typeof dbase !== 'string') {
            throw new TypeError('parameter 1 must be a non-empty string!');
        }
        if (!store || typeof store !== 'string') {
            throw new TypeError('parameter 2 must be a non-empty string!');
        }
        this.#dbase = dbase;
        this.#store = store;
        this.#db = new Promise((resolve, reject) => {
            let request = indexedDB.open(dbase, 1);
            request.onsuccess = () => resolve(request.result);
            request.onupgradeneeded = (event) => request.result.createObjectStore(store, { keyPath: 'key' });
            request.onerror = () => reject(request.error);
        });
    }
    version = '0.1';
    #dbase;
    #store;
    #db;
    #trans (mode) {
        return this.#db.then((db) => {
            let transaction = db.transaction(this.#store, mode);
            return transaction.objectStore(this.#store);
        });
    }
    set (key, value) {
        return new Promise(async (resolve, reject) => {
            let store = await this.#trans('readwrite');
            let request = store.put({ key, value });
            request.onsuccess = () => resolve(value);
            request.onerror = () => reject(request.error);
        });
    }
    get (key) {
        return new Promise(async (resolve, reject) => {
            let store = await this.#trans('readonly');
            let request = store.get(key);
            request.onsuccess = () => resolve(request.result?.value);
            request.onerror = () => reject(request.error);
        });
    }
    delete (key) {
        return new Promise(async (resolve, reject) => {
            let store = await this.#trans('readwrite');
            let request = store.delete(key);
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }
    entries () {
        return new Promise(async (resolve, reject) => {
            let store = await this.#trans('readonly');
            let request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    keys () {
        return new Promise(async (resolve, reject) => {
            let store = await this.#trans('readonly');
            let request = store.getAllKeys();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    values () {
        return this.entries().then((entries) => entries.map((item) => item.value));
    }
    clear () {
        return new Promise(async (resolve, reject) => {
            let store = await this.#trans('readwrite');
            let request = store.clear();
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }
    flush () {
        return new Promise(async (resolve, reject) => {
            let db = await this.#db;
            db.close();
            let request = indexedDB.deleteDatabase(this.#dbase);
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }
}
