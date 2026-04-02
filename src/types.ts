export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: 'user' | 'admin';
  isVip: boolean;
  createdAt: string;
}

export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: any;
  type: 'text' | 'voice' | 'image';
}

export interface CaptureItem {
  id: string;
  userId: string;
  type: 'note' | 'document' | 'location' | 'audio' | 'video' | 'schedule';
  content: any;
  metadata: {
    title: string;
    description?: string;
    tags?: string[];
    location?: { lat: number; lng: number };
  };
  createdAt: any;
}

export interface Folder {
  id: string;
  userId: string;
  name: string;
  color: string;
  itemIds: string[];
}
