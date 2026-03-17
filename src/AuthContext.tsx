import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: () => Promise<void>;
  logOut: () => Promise<void>;
  cacaVoiceUses: number;
  incrementCacaVoiceUses: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [cacaVoiceUses, setCacaVoiceUses] = useState(0);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Ensure user document exists
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
          await setDoc(userRef, {
            uid: currentUser.uid,
            email: currentUser.email,
            displayName: currentUser.displayName,
            photoURL: currentUser.photoURL,
            cacaVoiceUses: 0
          });
          setCacaVoiceUses(0);
        } else {
          setCacaVoiceUses(userSnap.data().cacaVoiceUses || 0);
        }
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signIn = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const logOut = async () => {
    await signOut(auth);
  };

  const incrementCacaVoiceUses = async () => {
    if (!user) return;
    const newUses = cacaVoiceUses + 1;
    if (newUses > 5) return;
    
    const userRef = doc(db, 'users', user.uid);
    await setDoc(userRef, { cacaVoiceUses: newUses }, { merge: true });
    setCacaVoiceUses(newUses);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, logOut, cacaVoiceUses, incrementCacaVoiceUses }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
