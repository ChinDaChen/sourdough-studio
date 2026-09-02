// window.storage 的瀏覽器替代實作。
// 一般資料（配方、器材、步驟、烘焙紀錄）走 localStorage；
// 照片因為 base64 體積大，走 IndexedDB，避開 localStorage 約 5MB 的上限。
// 對外介面刻意與原本的 window.storage 完全一致，App.jsx 不需要改動。

const DB_NAME = "sourdough";
const STORE = "photos";
const PHOTO_PREFIX = "sd_photo_";

const isPhoto = (key) => typeof key === "string" && key.startsWith(PHOTO_PREFIX);

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("此瀏覽器不支援 IndexedDB"));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(mode, run) {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      })
  );
}

export const storage = {
  async get(key) {
    if (isPhoto(key)) {
      const value = await tx("readonly", (s) => s.get(key));
      return value == null ? null : { key, value };
    }
    const value = localStorage.getItem(key);
    return value == null ? null : { key, value };
  },

  async set(key, value) {
    if (isPhoto(key)) {
      await tx("readwrite", (s) => s.put(value, key));
      return { key, value };
    }
    localStorage.setItem(key, value);
    return { key, value };
  },

  async delete(key) {
    if (isPhoto(key)) {
      await tx("readwrite", (s) => s.delete(key));
      return { key, deleted: true };
    }
    localStorage.removeItem(key);
    return { key, deleted: true };
  },

  async list(prefix = "") {
    if (isPhoto(prefix) || prefix === PHOTO_PREFIX) {
      const keys = await tx("readonly", (s) => s.getAllKeys());
      return { keys: keys.filter((k) => String(k).startsWith(prefix)), prefix };
    }
    const keys = Object.keys(localStorage).filter((k) => k.startsWith(prefix));
    return { keys, prefix };
  },
};
