import Dexie, { Table } from 'dexie';
import { db as firestore, auth, storage } from './firebase';
import { collection, doc, setDoc, getDocs, query, orderBy, writeBatch, Timestamp, deleteDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { googleDriveService } from './services/googleDrive';
import { handleFirestoreError, OperationType } from './utils/firestoreErrorHandler';

export interface ExoFolder {
  id: string;
  name: string;
  parentId: string | null; // For subfolders
  userId: string;
  timestamp: number;
}

export interface ExoItem {
  id: string;
  type: 'text' | 'photo' | 'location' | 'schedule' | 'audio' | 'video';
  content: string | Blob; // content can be text, base64, or Blob for media
  metadata?: any;
  timestamp: number;
  folderId: string; // "balaio" is the default
  syncStatus: 'synced' | 'pending' | 'error';
  userId: string;
  mediaUrl?: string; // URL from Firebase Storage
  title?: string;
  summary?: string;
}

// Network Awareness
export function isGoodConnection() {
  if (!navigator.onLine) return false;
  const conn = (navigator as any).connection;
  if (conn) {
    if (conn.saveData) return false; // User has data saver on
    const type = conn.effectiveType;
    if (type === 'slow-2g' || type === '2g' || type === '3g') return false;
  }
  return true;
}

// Local Database (IndexedDB)
export class LocalDatabase extends Dexie {
  items!: Table<ExoItem>;
  folders!: Table<ExoFolder>;

  constructor() {
    super('ExoMindDB');
    this.version(1).stores({
      items: 'id, type, timestamp, folderId, syncStatus, userId',
      folders: 'id, name, parentId, userId, timestamp'
    });
  }
}

export const localDb = new LocalDatabase();

// --- Folder Functions ---

export async function saveFolder(folder: ExoFolder) {
  const user = auth.currentUser;
  if (!user) throw new Error('User not authenticated');
  
  // Ensure userId is set
  folder.userId = user.uid;
  
  // Save locally
  await localDb.folders.put(folder);
  
  // Save to Firestore
  const path = `users/${user.uid}/folders/${folder.id}`;
  try {
    const folderRef = doc(firestore, 'users', user.uid, 'folders', folder.id);
    await setDoc(folderRef, {
      ...folder,
      createdAt: Timestamp.fromMillis(folder.timestamp)
    });
  } catch (error: any) {
    if (error.code === 'permission-denied') {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
    throw error;
  }
}

export async function getFolders(): Promise<ExoFolder[]> {
  const user = auth.currentUser;
  if (!user) return [];
  
  // Try to get from local first
  const localFolders = await localDb.folders.where('userId').equals(user.uid).toArray();
  if (localFolders.length > 0) return localFolders;

  // If local empty, fetch from Firestore
  const path = `users/${user.uid}/folders`;
  try {
    const foldersRef = collection(firestore, 'users', user.uid, 'folders');
    const snapshot = await getDocs(foldersRef);
    const firestoreFolders = snapshot.docs.map(doc => doc.data() as ExoFolder);
    
    // Sync to local
    if (firestoreFolders.length > 0) {
      await localDb.folders.bulkPut(firestoreFolders);
    }
    
    return firestoreFolders;
  } catch (error: any) {
    if (error.code === 'permission-denied') {
      handleFirestoreError(error, OperationType.GET, path);
    }
    return [];
  }
}

export async function deleteFolder(id: string) {
  const user = auth.currentUser;
  if (!user) throw new Error('User not authenticated');
  
  // Delete locally
  await localDb.folders.delete(id);
  
  // Delete from Firestore
  const folderRef = doc(firestore, 'users', user.uid, 'folders', id);
  await deleteDoc(folderRef);

  // Move items in this folder to "balaio"
  const itemsToMove = await localDb.items.where('folderId').equals(id).toArray();
  await localDb.items.where('folderId').equals(id).modify({ folderId: 'balaio', syncStatus: 'pending' });
  
  // Trigger sync for each moved item
  for (const item of itemsToMove) {
    syncItemToCloud({ ...item, folderId: 'balaio', syncStatus: 'pending' }).catch(err => {
      console.error('Sync failed for item after folder deletion:', item.id, err);
    });
  }
}

// --- Item Functions ---

export async function saveItem(item: Omit<ExoItem, 'userId' | 'syncStatus'> & Partial<Pick<ExoItem, 'userId' | 'syncStatus'>>) {
  const user = auth.currentUser;
  if (!user) throw new Error('User not authenticated');
  
  // Set defaults and ensure userId is correct
  const fullItem: ExoItem = {
    ...item,
    userId: user.uid,
    syncStatus: 'pending'
  };
  
  // Save locally first (Offline-First)
  await localDb.items.put(fullItem);
  
  // Trigger sync in background
  syncItemToCloud(fullItem).catch(err => {
    console.error('Background sync failed:', err);
  });
}

export async function syncItemToCloud(item: ExoItem) {
  const user = auth.currentUser;
  if (!user || !navigator.onLine) return;

  // Smart Sync: Don't upload heavy media on slow connections
  const isHeavy = item.type === 'audio' || item.type === 'video' || item.type === 'photo';
  if (isHeavy && !isGoodConnection()) {
    console.log(`Skipping heavy sync for ${item.id} due to slow connection`);
    return;
  }

  try {
    let mediaUrl = item.mediaUrl;

    // If it's media and not uploaded yet
    if ((item.type === 'audio' || item.type === 'video' || item.type === 'photo') && !mediaUrl) {
      const fileExtension = item.type === 'audio' ? 'webm' : item.type === 'video' ? 'webm' : 'jpg';
      const storageRef = ref(storage, `users/${user.uid}/${item.type}/${item.id}.${fileExtension}`);
      
      let blob: Blob;
      if (item.content instanceof Blob) {
        blob = item.content;
      } else if (typeof item.content === 'string' && item.content.startsWith('data:')) {
        // Convert base64 to blob
        const res = await fetch(item.content);
        blob = await res.blob();
      } else {
        throw new Error('Invalid content for media upload');
      }

      await uploadBytes(storageRef, blob);
      mediaUrl = await getDownloadURL(storageRef);
    }

    // Save metadata to Firestore
    const path = `users/${user.uid}/items/${item.id}`;
    const itemRef = doc(firestore, 'users', user.uid, 'items', item.id);
    const cleanMetadata = item.metadata ? JSON.parse(JSON.stringify(item.metadata)) : null;

    // --- Google Drive Sync ---
    const googleToken = localStorage.getItem('google_drive_token');
    const googleTokenExpiry = localStorage.getItem('google_drive_token_expiry');
    
    if (googleToken && googleTokenExpiry && Date.now() < parseInt(googleTokenExpiry)) {
      try {
        googleDriveService.setAccessToken(googleToken);
        
        const fileName = `${item.type}_${item.id}`;
        let mimeType = 'application/json';
        let content: Blob | string = JSON.stringify({ ...item, mediaUrl });

        if (item.type === 'photo') mimeType = 'image/jpeg';
        else if (item.type === 'audio') mimeType = 'audio/webm';
        else if (item.type === 'video') mimeType = 'video/webm';

        if (item.type === 'photo' || item.type === 'audio' || item.type === 'video') {
          // For media, we upload the actual file
          if (item.content instanceof Blob) {
            content = item.content;
          } else if (typeof item.content === 'string' && item.content.startsWith('data:')) {
            const res = await fetch(item.content);
            content = await res.blob();
          }
        }

        await googleDriveService.uploadFile(fileName, mimeType, content, { ...item, mediaUrl });
        console.log(`Item ${item.id} synced to Google Drive`);
      } catch (driveError) {
        console.error('Google Drive sync error:', driveError);
        // We don't fail the whole sync if Drive fails, but we log it
      }
    }

    try {
      await setDoc(itemRef, {
        id: item.id,
        type: item.type,
        content: typeof item.content === 'string' ? item.content : '(media file)',
        metadata: cleanMetadata,
        timestamp: item.timestamp,
        folderId: item.folderId,
        mediaUrl: mediaUrl || null,
        createdAt: Timestamp.fromMillis(item.timestamp),
        title: item.title || null,
        summary: item.summary || null
      });
    } catch (error: any) {
      if (error.code === 'permission-denied') {
        handleFirestoreError(error, OperationType.WRITE, path);
      }
      throw error;
    }

    // Update local status
    await localDb.items.update(item.id, { syncStatus: 'synced', mediaUrl });

    // --- Google Drive Sync ---
    const gToken = localStorage.getItem('google_drive_token');
    const gTokenExpiry = localStorage.getItem('google_drive_token_expiry');
    
    if (gToken && gTokenExpiry && Date.now() < parseInt(gTokenExpiry)) {
      try {
        const { googleDriveService } = await import('./services/googleDrive');
        googleDriveService.setAccessToken(gToken);
        
        const fileName = `${item.type}_${item.id}`;
        const content = JSON.stringify({
          ...item,
          mediaUrl // Ensure mediaUrl is included
        }, null, 2);
        
        await googleDriveService.uploadFile(fileName, content, 'application/json', item.type);
        console.log(`Item ${item.id} synced to Google Drive`);
      } catch (driveError) {
        console.error('Google Drive sync error for item:', item.id, driveError);
      }
    }
  } catch (error) {
    console.error('Sync error:', error);
    await localDb.items.update(item.id, { syncStatus: 'error' });
  }
}

export async function getItems(folderId?: string): Promise<ExoItem[]> {
  const user = auth.currentUser;
  if (!user) return [];
  
  // Try to sync from cloud if online and local is empty or specifically requested
  // For now, we just fetch local and provide a way to trigger full sync
  
  let items = await localDb.items.where('userId').equals(user.uid).toArray();
  if (folderId && folderId !== 'all') {
    items = items.filter(item => item.folderId === folderId);
  }
  return items;
}

export async function fetchItemsFromCloud() {
  const user = auth.currentUser;
  if (!user || !navigator.onLine) return;

  const path = `users/${user.uid}/items`;
  try {
    const itemsRef = collection(firestore, 'users', user.uid, 'items');
    const snapshot = await getDocs(itemsRef);
    const firestoreItems = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        syncStatus: 'synced'
      } as ExoItem;
    });

    if (firestoreItems.length > 0) {
      // Use bulkPut to update local database with cloud data
      // We don't want to overwrite local items that are 'pending'
      for (const item of firestoreItems) {
        const localItem = await localDb.items.get(item.id);
        if (!localItem || localItem.syncStatus === 'synced') {
          await localDb.items.put(item);
        }
      }
    }
  } catch (error: any) {
    if (error.code === 'permission-denied') {
      handleFirestoreError(error, OperationType.GET, path);
    } else {
      console.error('Error fetching items from cloud:', error);
    }
  }
}

export async function deleteItem(id: string) {
  const user = auth.currentUser;
  if (!user) throw new Error('User not authenticated');
  
  const item = await localDb.items.get(id);
  if (!item) return;

  // Delete locally
  await localDb.items.delete(id);
  
  // Delete from Firestore
  const itemRef = doc(firestore, 'users', user.uid, 'items', id);
  await deleteDoc(itemRef);

  // Delete from Storage if exists
  if (item.mediaUrl) {
    try {
      const fileExtension = item.type === 'audio' ? 'webm' : item.type === 'video' ? 'webm' : 'jpg';
      const storageRef = ref(storage, `users/${user.uid}/${item.type}/${item.id}.${fileExtension}`);
      await deleteObject(storageRef);
    } catch (e) {
      console.error('Error deleting from storage:', e);
    }
  }

  // Delete from Google Drive if connected
  const dToken = localStorage.getItem('google_drive_token');
  const dTokenExpiry = localStorage.getItem('google_drive_token_expiry');
  if (dToken && dTokenExpiry && Date.now() < parseInt(dTokenExpiry)) {
    try {
      googleDriveService.setAccessToken(dToken);
      const fileName = `${item.type}_${item.id}`;
      await googleDriveService.deleteFile(fileName, item.type);
    } catch (driveError) {
      console.error('Google Drive delete error:', driveError);
    }
  }
}

export async function updateItemFolder(itemId: string, newFolderId: string) {
  const user = auth.currentUser;
  if (!user) throw new Error('User not authenticated');

  await localDb.items.update(itemId, { folderId: newFolderId, syncStatus: 'pending' });
  
  const itemRef = doc(firestore, 'users', user.uid, 'items', itemId);
  await updateDoc(itemRef, { folderId: newFolderId });
  
  const updatedItem = await localDb.items.get(itemId);
  if (updatedItem) {
    syncItemToCloud(updatedItem).catch(err => console.error('Sync failed after folder update:', err));
  }
}

export async function updateItemMetadata(itemId: string, title: string, summary: string) {
  const user = auth.currentUser;
  if (!user) throw new Error('User not authenticated');

  // Update locally
  await localDb.items.update(itemId, { title, summary, syncStatus: 'pending' });
  
  // Update in Firestore
  const itemRef = doc(firestore, 'users', user.uid, 'items', itemId);
  await updateDoc(itemRef, { 
    title, 
    summary,
    'metadata.title': title,
    'metadata.summary': summary,
    'metadata.description': summary // Keep description in sync for now as it's used in some places
  });
  
  const updatedItem = await localDb.items.get(itemId);
  if (updatedItem) {
    syncItemToCloud(updatedItem).catch(err => console.error('Sync failed after metadata update:', err));
  }
}

export async function importItems(items: ExoItem[]) {
  const user = auth.currentUser;
  if (!user) throw new Error('User not authenticated');
  
  // Ensure all items have the correct userId and syncStatus
  const itemsToImport = items.map(item => ({
    ...item,
    userId: user.uid,
    syncStatus: 'pending' as const
  }));
  
  await localDb.items.bulkPut(itemsToImport);
  
  // Trigger sync for all
  syncAllPending().catch(console.error);
}

// Background sync for all pending items
export async function syncAllPending() {
  if (!navigator.onLine) return;
  const user = auth.currentUser;
  if (!user) return;

  const pendingItems = await localDb.items.where('syncStatus').equals('pending').toArray();
  for (const item of pendingItems) {
    await syncItemToCloud(item);
  }
}
