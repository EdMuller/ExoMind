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
  isVip: boolean;
  unlockVip: (code: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [cacaVoiceUses, setCacaVoiceUses] = useState(0);
  const [isVip, setIsVip] = useState(false);

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
            cacaVoiceUses: 0,
            isVip: false
          });
          setCacaVoiceUses(0);
          setIsVip(false);
        } else {
          const data = userSnap.data();
          setCacaVoiceUses(data.cacaVoiceUses || 0);
          setIsVip(data.isVip || false);
        }
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error("Error signing in:", error);
      if (error.code === 'auth/unauthorized-domain') {
        alert("Erro: O domínio atual não está autorizado no Firebase.\n\nPara consertar isso:\n1. Vá no Console do Firebase (Authentication > Settings > Authorized domains)\n2. Adicione o domínio deste site à lista.");
      } else {
        alert("Erro ao fazer login: " + error.message);
      }
    }
  };

  const logOut = async () => {
    await signOut(auth);
  };

  const incrementCacaVoiceUses = async () => {
    if (!user || isVip) return; // VIPs have unlimited uses
    const newUses = cacaVoiceUses + 1;
    if (newUses > 5) return;
    
    const userRef = doc(db, 'users', user.uid);
    await setDoc(userRef, { cacaVoiceUses: newUses }, { merge: true });
    setCacaVoiceUses(newUses);
  };

  const unlockVip = async (code: string) => {
    if (!user) return false;
    const normalizedCode = code.trim().toUpperCase();
    if (normalizedCode === 'CACÁ61' || normalizedCode === 'CACA61') {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, { isVip: true }, { merge: true });
      setIsVip(true);
      return true;
    }
    return false;
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, logOut, cacaVoiceUses, incrementCacaVoiceUses, isVip, unlockVip }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
