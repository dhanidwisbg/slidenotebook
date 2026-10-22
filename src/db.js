// IndexedDB Manager for Handbook Flipbook
// Separates pages and audio blobs for blazing performance (PRD FR-12)

const DB_NAME = 'HandbookFlipbookDB';
const DB_VERSION = 1;

let dbPromise = null;

export function openDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = e.target.result;

      if (!db.objectStoreNames.contains('handbooks')) {
        db.createObjectStore('handbooks', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('pages')) {
        const pageStore = db.createObjectStore('pages', { keyPath: 'id' });
        pageStore.createIndex('handbookId', 'handbookId', { unique: false });
        pageStore.createIndex('order', 'order', { unique: false });
      }

      if (!db.objectStoreNames.contains('media')) {
        db.createObjectStore('media', { keyPath: 'id' });
      }
    };

    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });

  return dbPromise;
}

export async function saveHandbookMeta(handbook) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('handbooks', 'readwrite');
    const store = tx.objectStore('handbooks');
    const request = store.put({
      ...handbook,
      updatedAt: Date.now()
    });
    request.onsuccess = () => resolve();
    request.onerror = (e) => reject(e.target.error);
  });
}

export async function getHandbookMeta(id = 'default') {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('handbooks', 'readonly');
    const store = tx.objectStore('handbooks');
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = (e) => reject(e.target.error);
  });
}

export async function savePages(handbookId, pages) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pages', 'readwrite');
    const store = tx.objectStore('pages');
    const index = store.index('handbookId');

    // Remove existing pages for this handbook first
    const req = index.openKeyCursor(IDBKeyRange.only(handbookId));
    req.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        store.delete(cursor.primaryKey);
        cursor.continue();
      } else {
        // Put all new pages
        pages.forEach((p, idx) => {
          store.put({
            ...p,
            handbookId,
            order: idx
          });
        });
      }
    };

    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
}

export async function getPages(handbookId = 'default') {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pages', 'readonly');
    const store = tx.objectStore('pages');
    const index = store.index('handbookId');
    const request = index.getAll(IDBKeyRange.only(handbookId));

    request.onsuccess = () => {
      const list = request.result || [];
      list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      resolve(list);
    };
    request.onerror = (e) => reject(e.target.error);
  });
}

export async function saveMedia(handbookId, audioData) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('media', 'readwrite');
    const store = tx.objectStore('media');
    const request = store.put({
      id: `audio_${handbookId}`,
      handbookId,
      ...audioData
    });
    request.onsuccess = () => resolve();
    request.onerror = (e) => reject(e.target.error);
  });
}

export async function getMedia(handbookId = 'default') {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('media', 'readonly');
    const store = tx.objectStore('media');
    const request = store.get(`audio_${handbookId}`);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = (e) => reject(e.target.error);
  });
}

export async function deleteMedia(handbookId = 'default') {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('media', 'readwrite');
    const store = tx.objectStore('media');
    const request = store.delete(`audio_${handbookId}`);
    request.onsuccess = () => resolve();
    request.onerror = (e) => reject(e.target.error);
  });
}

export async function clearAll(handbookId = 'default') {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['handbooks', 'pages', 'media'], 'readwrite');
    tx.objectStore('handbooks').delete(handbookId);
    
    const pageIndex = tx.objectStore('pages').index('handbookId');
    pageIndex.openKeyCursor(IDBKeyRange.only(handbookId)).onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        tx.objectStore('pages').delete(cursor.primaryKey);
        cursor.continue();
      }
    };
    
    tx.objectStore('media').delete(`audio_${handbookId}`);
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
}
