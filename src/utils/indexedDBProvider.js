// src/utils/indexedDBProvider.js

const DB_NAME = 'swr-cache-db';
const STORE_NAME = 'cache';
const DB_VERSION = 1;
const CACHE_EXPIRY = 7*24 * 60 * 60 * 1000; // 7 days

class IndexedDBCache {
  constructor() {
    this.db = null;
    this.memoryCache = new Map();
    this.pendingWrites = new Map();
    this.writeTimeout = null;
    this.isReady = false;
    this.readyPromise = this.init();
  }

  async init() {
    try {
      this.db = await this.openDB();
      await this.loadToMemory();
      this.isReady = true;
    } catch (error) {
      console.warn('IndexedDB not available, using memory cache:', error);
      this.isReady = true;
    }
  }

  openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
      };
    });
  }

  async loadToMemory() {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const now = Date.now();
        request.result.forEach(item => {
          // Skip expired entries
          if (item.timestamp && now - item.timestamp < CACHE_EXPIRY) {
            this.memoryCache.set(item.key, item.value);
          }
        });
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  get(key) {
    return this.memoryCache.get(key);
  }

  set(key, value) {
    const wrappedValue = {
      data: value,
      timestamp: Date.now()
    };
    
    this.memoryCache.set(key, wrappedValue);
    this.pendingWrites.set(key, wrappedValue);
    this.scheduleBatchWrite();
    
    return this;
  }

  delete(key) {
    this.memoryCache.delete(key);
    this.pendingWrites.set(key, null); // null means delete
    this.scheduleBatchWrite();
    return true;
  }

  has(key) {
    return this.memoryCache.has(key);
  }

  keys() {
    return this.memoryCache.keys();
  }

  scheduleBatchWrite() {
    if (this.writeTimeout) return;

    this.writeTimeout = setTimeout(() => {
      this.batchWrite();
      this.writeTimeout = null;
    }, 1000);
  }

  async batchWrite() {
    if (!this.db || this.pendingWrites.size === 0) return;

    const writes = new Map(this.pendingWrites);
    this.pendingWrites.clear();

    try {
      const transaction = this.db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      writes.forEach((value, key) => {
        if (value === null) {
          store.delete(key);
        } else {
          store.put({ key, value: value.data, timestamp: value.timestamp });
        }
      });

      await new Promise((resolve, reject) => {
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
      });
    } catch (error) {
      console.warn('Failed to write to IndexedDB:', error);
    }
  }

  async clear() {
    this.memoryCache.clear();
    this.pendingWrites.clear();

    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = resolve;
      request.onerror = () => reject(request.error);
    });
  }

  // Map interface compatibility
  forEach(callback) {
    this.memoryCache.forEach(callback);
  }

  get size() {
    return this.memoryCache.size;
  }

  [Symbol.iterator]() {
    return this.memoryCache[Symbol.iterator]();
  }
}

let cacheInstance = null;

export const indexedDBProvider = () => {
  if (!cacheInstance) {
    cacheInstance = new IndexedDBCache();
  }
  return cacheInstance.memoryCache;
};

export const getIndexedDBCache = () => {
  if (!cacheInstance) {
    cacheInstance = new IndexedDBCache();
  }
  return cacheInstance;
};