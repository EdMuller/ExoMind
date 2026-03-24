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
  plan: 'Bronze' | 'Prata' | 'Ouro' | 'Diamante';
  unlockVip: (code: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const APP_VERSION = '1.1.2';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [cacaVoiceUses, setCacaVoiceUses] = useState(0);
  const [isVip, setIsVip] = useState(false);
  const [plan, setPlan] = useState<'Bronze' | 'Prata' | 'Ouro' | 'Diamante'>('Bronze');

  useEffect(() => {
    const checkVersionAndAuth = async () => {
      const lastVersion = localStorage.getItem('app_version');
      console.log('App Version Check:', { lastVersion, currentVersion: APP_VERSION });
      
      if (lastVersion && lastVersion !== APP_VERSION) {
        console.log('Version mismatch detected. Forcing logout...');
        // Force logout on version change
        await signOut(auth);
        localStorage.setItem('app_version', APP_VERSION);
        localStorage.setItem('caca_voice_reset_done', 'false');
        // Clear session storage to force fresh state
        sessionStorage.clear();
        window.location.reload();
        return;
      }
      
      localStorage.setItem('app_version', APP_VERSION);

      const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        setUser(currentUser);
        if (currentUser) {
          const userRef = doc(db, 'users', currentUser.uid);
          const userSnap = await getDoc(userRef);
          
          let userData: any;
          if (!userSnap.exists()) {
            userData = {
              uid: currentUser.uid,
              email: currentUser.email,
              displayName: currentUser.displayName,
              photoURL: currentUser.photoURL,
              cacaVoiceUses: 0,
              isVip: currentUser.email === 'empresarioholistico@gmail.com', // Auto-VIP for the user
              plan: currentUser.email === 'empresarioholistico@gmail.com' ? 'Diamante' : 'Bronze'
            };
            await setDoc(userRef, userData);
          } else {
            userData = userSnap.data();
            // Ensure the user is always VIP if they are the owner
            if (currentUser.email === 'empresarioholistico@gmail.com' && (!userData.isVip || userData.plan !== 'Diamante')) {
              userData.isVip = true;
              userData.plan = 'Diamante';
              await setDoc(userRef, { isVip: true, plan: 'Diamante' }, { merge: true });
            }
          }

          // Development Reset Logic (requested by user)
          if (localStorage.getItem('caca_voice_reset_done') !== 'true') {
            userData.cacaVoiceUses = 0;
            await setDoc(userRef, { cacaVoiceUses: 0 }, { merge: true });
            localStorage.setItem('caca_voice_reset_done', 'true');
          }

          setCacaVoiceUses(userData.cacaVoiceUses || 0);
          setIsVip(userData.isVip || false);
          setPlan(userData.plan || 'Bronze');
        }
        setLoading(false);
      });

      return unsubscribe;
    };

    const authUnsubscribePromise = checkVersionAndAuth();
    return () => {
      authUnsubscribePromise.then(unsubscribe => {
        if (typeof unsubscribe === 'function') unsubscribe();
      });
    };
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
    sessionStorage.removeItem('birthdayShown');
    await signOut(auth);
  };

  const incrementCacaVoiceUses = async () => {
    if (!user || isVip) return; // VIPs have unlimited uses
    const newUses = cacaVoiceUses + 1;
    if (newUses > 10) return;
    
    const userRef = doc(db, 'users', user.uid);
    await setDoc(userRef, { cacaVoiceUses: newUses }, { merge: true });
    setCacaVoiceUses(newUses);
  };

  const unlockVip = async (code: string) => {
    if (!user) return false;
    const normalizedCode = code.trim().toUpperCase();
    if (normalizedCode === 'CACÁ61' || normalizedCode === 'CACA61') {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, { isVip: true, plan: 'Diamante' }, { merge: true });
      setIsVip(true);
      setPlan('Diamante');
      sessionStorage.setItem('justUnlockedVip', 'true');
      window.dispatchEvent(new Event('vipUnlocked'));
      return true;
    }
    return false;
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, logOut, cacaVoiceUses, incrementCacaVoiceUses, isVip, plan, unlockVip }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
