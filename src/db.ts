import { db, auth } from './firebase';
import { collection, doc, setDoc, getDocs, query, orderBy, writeBatch, Timestamp, deleteDoc } from 'firebase/firestore';

export interface ExoItem {
  id: string;
  type: 'text' | 'photo' | 'location';
  content: string; // text content, base64 photo, or location string
  metadata?: any;
  timestamp: number;
}

export async function saveItem(item: ExoItem) {
  const user = auth.currentUser;
  if (!user) throw new Error('User not authenticated');
  
  const itemRef = doc(db, 'users', user.uid, 'items', item.id);
  await setDoc(itemRef, {
    id: item.id,
    type: item.type,
    content: item.content,
    metadata: item.metadata || null,
    timestamp: item.timestamp,
    createdAt: Timestamp.fromMillis(item.timestamp)
  });
}

export async function getItems(): Promise<ExoItem[]> {
  const user = auth.currentUser;
  if (!user) return [];
  
  const itemsRef = collection(db, 'users', user.uid, 'items');
  const q = query(itemsRef, orderBy('timestamp', 'asc'));
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => doc.data() as ExoItem);
}

export async function deleteItem(id: string) {
  const user = auth.currentUser;
  if (!user) throw new Error('User not authenticated');
  
  const itemRef = doc(db, 'users', user.uid, 'items', id);
  await deleteDoc(itemRef);
}

export async function importItems(items: ExoItem[]) {
  const user = auth.currentUser;
  if (!user) throw new Error('User not authenticated');
  
  const batch = writeBatch(db);
  for (const item of items) {
    const itemRef = doc(db, 'users', user.uid, 'items', item.id);
    batch.set(itemRef, {
      id: item.id,
      type: item.type,
      content: item.content,
      metadata: item.metadata || null,
      timestamp: item.timestamp,
      createdAt: Timestamp.fromMillis(item.timestamp)
    });
  }
  await batch.commit();
}
