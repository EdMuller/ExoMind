import { openDB, DBSchema } from 'idb';

export interface ExoMindDB extends DBSchema {
  items: {
    key: string;
    value: {
      id: string;
      type: 'text' | 'photo' | 'location';
      content: string; // text content, base64 photo, or location string
      metadata?: any;
      timestamp: number;
    };
    indexes: { 'by-date': number };
  };
}

export async function initDB() {
  return openDB<ExoMindDB>('exomind-db', 1, {
    upgrade(db) {
      const store = db.createObjectStore('items', {
        keyPath: 'id',
      });
      store.createIndex('by-date', 'timestamp');
    },
  });
}

export async function saveItem(item: ExoMindDB['items']['value']) {
  const db = await initDB();
  await db.put('items', item);
}

export async function getItems() {
  const db = await initDB();
  return db.getAllFromIndex('items', 'by-date');
}

export async function importItems(items: ExoMindDB['items']['value'][]) {
  const db = await initDB();
  const tx = db.transaction('items', 'readwrite');
  for (const item of items) {
    await tx.store.put(item);
  }
  await tx.done;
}
