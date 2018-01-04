const assetCountKey = 'assetCount';
self.addEventListener('fetch', function (event) {
  const updateAssetCount = get(assetCountKey).then((count) => {
    const newCount = count + 1;
    return set(assetCountKey, newCount).then(() => {
      console.log('Updated asset count', newCount);
    });
  });
  const proxy = updateAssetCount.then(() => {
    return fetch(event.request);
  });
  event.respondWith(proxy);
});

self.addEventListener('install', function (event) {
  event.waitUntil(set(assetCountKey, 0).then(self.skipWaiting()));
});

const DB_OP_TIMEOUT = 100;
const OPEN_DB_TIMEOUT = 100;

function guardPromise(promise, timeoutMessage, msTimeout) {
  const timeout = new Promise((resolve, reject) => {
    // Create error outside of setTimeout to get proper stack
    const err = new Error(timeoutMessage);
    const timer = setTimeout(() => {
      reject(err);
    }, msTimeout);
    const cancel = clearTimeout.bind(null, timer);
    promise.then(cancel, cancel);
  });

  return Promise.race([timeout, promise]);
}

// IndexDB Constants
const DB_NAME = 'sw-store';
const OBJECT_STORE_NAME = 'state';

function exec(req, transaction, label) {
  const result = new Promise((resolve, reject) => {
    transaction.oncomplete = () => {
      resolve(req.result);
    };
    transaction.onerror = () => {
      reject(new Error(`IndexedDB transaction error: ${transaction.error.message}`));
    };
  });

  return guardPromise(result, `IndexedDB Timeout: ${label}`, DB_OP_TIMEOUT);
}

function openDB() {
  const open  = new Promise((resolve, reject) => {
    const dbReq = indexedDB.open(DB_NAME);

    dbReq.onblocked = () => {
      reject(new Error('IndexedDB blocked'));
    };

    dbReq.onerror = () => {
      reject(new Error(`IndexedDB error: ${dbReq.error.message}`));
    };

    dbReq.onupgradeneeded = () => {
      dbReq.result.createObjectStore(OBJECT_STORE_NAME);
    };

    dbReq.onsuccess = function() {
      resolve(dbReq.result);
    };
  });
  return guardPromise(open, 'Timeout opening IndexedDB', OPEN_DB_TIMEOUT);
}


function getStore(mode, cb) {
  const req = openDB().then((db) => {
    const transaction = db.transaction(OBJECT_STORE_NAME, mode);
    // We can't return/resolve a promise with the transaction because the transaction
    // must be used synchronously. Otherwise the browser can close the transaction
    return cb({
      transaction,
      store: transaction.objectStore(OBJECT_STORE_NAME)
    });
  });

  return guardPromise(req, 'Timeout getting object store', DB_OP_TIMEOUT);
}

function set(key, value) {
  return getStore('readwrite', ({ store, transaction}) => {
    return exec(store.put(value, key), transaction, `Setting key [${key}]`);
  });
}
function get(key) {
  return getStore('readonly', ({ store, transaction}) => {
    return exec(store.get(key), transaction, `Getting key [${key}]`);
  });
}