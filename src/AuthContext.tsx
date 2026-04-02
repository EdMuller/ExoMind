import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { doc, getDoc, getDocs, setDoc, collection, addDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { handleFirestoreError, OperationType } from './utils/firestoreErrorHandler';
import { APP_VERSION } from './constants';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: () => Promise<void>;
  logOut: () => Promise<void>;
  isVip: boolean;
  plan: 'Bronze' | 'Prata' | 'Ouro' | 'Diamante';
  role: 'admin' | 'user';
  unlockVip: (code: string) => Promise<boolean>;
  maintenanceMode: boolean;
  forceUpdate: boolean;
  publishedVersion: string;
  betaMode: boolean;
  supportWhatsapp: string;
  defaultCredits: number;
  googleDriveConnected: boolean;
  googleAccessToken: string | null;
  syncingToDrive: boolean;
  syncProgress: { current: number; total: number } | null;
  lastSyncTime: string | null;
  credits: number;
  spendCredits: (amount: number, description: string) => Promise<boolean>;
  connectGoogleDrive: () => Promise<void>;
  syncAllToGoogleDrive: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isVip, setIsVip] = useState(false);
  const [plan, setPlan] = useState<'Bronze' | 'Prata' | 'Ouro' | 'Diamante'>('Bronze');
  const [role, setRole] = useState<'admin' | 'user'>('user');
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [forceUpdate, setForceUpdate] = useState(false);
  const [publishedVersion, setPublishedVersion] = useState(APP_VERSION);
  const [betaMode, setBetaMode] = useState(false);
  const [supportWhatsapp, setSupportWhatsapp] = useState('5511999999999');
  const [defaultCredits, setDefaultCredits] = useState(50);
  const [credits, setCredits] = useState(0);
  const [googleDriveConnected, setGoogleDriveConnected] = useState(false);
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);
  const [syncingToDrive, setSyncingToDrive] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number } | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  useEffect(() => {
    const savedToken = localStorage.getItem('google_drive_token');
    const tokenExpiry = localStorage.getItem('google_drive_token_expiry');
    const savedLastSync = localStorage.getItem('google_drive_last_sync');
    
    if (savedLastSync) {
      setLastSyncTime(savedLastSync);
    }
    
    if (savedToken && tokenExpiry && Date.now() < parseInt(tokenExpiry)) {
      setGoogleAccessToken(savedToken);
      setGoogleDriveConnected(true);
      import('./services/googleDrive').then(({ googleDriveService }) => {
        googleDriveService.setAccessToken(savedToken);
      });
    }
  }, []);

  useEffect(() => {
    // Check for maintenance mode and updates
    const checkAppConfig = async () => {
      const path = 'config/app_config';
      try {
        const configDoc = await getDoc(doc(db, 'config', 'app_config'));
        if (configDoc.exists()) {
          const data = configDoc.data();
          setMaintenanceMode(data.maintenanceMode || false);
          setForceUpdate(data.forceUpdate || false);
          setPublishedVersion(data.currentVersion || APP_VERSION);
          setBetaMode(data.betaMode || false);
          setSupportWhatsapp(data.supportWhatsapp || '5511999999999');
          setDefaultCredits(data.defaultCredits || 50);
        } else if (user && user.email === 'empresarioholistico@gmail.com') {
          // Initialize config if it doesn't exist and user is admin
          const defaultConfig = {
            maintenanceMode: false,
            forceUpdate: false,
            currentVersion: APP_VERSION,
            betaMode: false,
            supportWhatsapp: '5511999999999',
            defaultCredits: 50
          };
          await setDoc(doc(db, 'config', 'app_config'), defaultConfig);
          console.log('App config initialized');
        }
      } catch (error: any) {
        if (error.code === 'permission-denied') {
          console.error('Error checking app config:', handleFirestoreError(error, OperationType.GET, path));
        } else {
          console.error('Error checking app config:', error);
        }
      }
    };

    checkAppConfig();
  }, []);

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
          
          // Fetch config for default credits if user is new
          let currentDefaultCredits = defaultCredits;
          if (!userSnap.exists()) {
            try {
              const configDoc = await getDoc(doc(db, 'config', 'app_config'));
              if (configDoc.exists()) {
                currentDefaultCredits = configDoc.data().defaultCredits || 50;
              }
            } catch (error: any) {
              if (error.code === 'permission-denied') {
                handleFirestoreError(error, OperationType.GET, 'config/app_config');
              }
            }
          }

          let userData: any;
          if (!userSnap.exists()) {
            userData = {
              uid: currentUser.uid,
              email: currentUser.email,
              displayName: currentUser.displayName,
              photoURL: currentUser.photoURL,
              isVip: currentUser.email === 'empresarioholistico@gmail.com', // Auto-VIP for the user
              plan: currentUser.email === 'empresarioholistico@gmail.com' ? 'Diamante' : 'Bronze',
              role: currentUser.email === 'empresarioholistico@gmail.com' ? 'admin' : 'user',
              credits: currentDefaultCredits,
              totalSpent: 0,
              totalProfit: 0,
              subscriptionDate: Date.now()
            };
            try {
              await setDoc(userRef, userData);
            } catch (error: any) {
              if (error.code === 'permission-denied') {
                handleFirestoreError(error, OperationType.WRITE, `users/${currentUser.uid}`);
              }
              throw error;
            }
          } else {
            userData = userSnap.data();
            // Ensure the user is always VIP if they are the owner
            if (currentUser.email === 'empresarioholistico@gmail.com' && (!userData.isVip || userData.plan !== 'Diamante' || userData.role !== 'admin')) {
              userData.isVip = true;
              userData.plan = 'Diamante';
              userData.role = 'admin';
              try {
                await setDoc(userRef, { isVip: true, plan: 'Diamante', role: 'admin' }, { merge: true });
              } catch (error: any) {
                if (error.code === 'permission-denied') {
                  handleFirestoreError(error, OperationType.WRITE, `users/${currentUser.uid}`);
                }
              }
            }

            // Initialize plans if they don't exist
            try {
              const plansSnap = await getDocs(collection(db, 'plans'));
              if (plansSnap.empty && currentUser.email === 'empresarioholistico@gmail.com') {
                const defaultPlans = [
                  { 
                    id: 'bronze', 
                    name: 'Bronze', 
                    price: 47, 
                    conv: '60%', 
                    delivery: '500 Créditos / 10h Voz', 
                    profit: 18.80, 
                    color: 'text-orange-400',
                    depositValue: 47,
                    conversionFactor: 0.25,
                    benefits: ['500 Créditos', '10h de Voz IA', 'Suporte Básico'],
                    duration: '30 dias'
                  },
                  { 
                    id: 'prata', 
                    name: 'Prata', 
                    price: 97, 
                    conv: '70%', 
                    delivery: '1200 Créditos / 25h Voz', 
                    profit: 29.10, 
                    color: 'text-slate-300',
                    depositValue: 97,
                    conversionFactor: 0.25,
                    benefits: ['1200 Créditos', '25h de Voz IA', 'Suporte Prioritário'],
                    duration: '30 dias'
                  },
                  { 
                    id: 'ouro', 
                    name: 'Ouro', 
                    price: 197, 
                    conv: '80%', 
                    delivery: '3000 Créditos / 60h Voz', 
                    profit: 39.40, 
                    color: 'text-yellow-400',
                    depositValue: 197,
                    conversionFactor: 0.25,
                    benefits: ['3000 Créditos', '60h de Voz IA', 'Suporte 24/7'],
                    duration: '30 dias'
                  },
                  { 
                    id: 'diamante', 
                    name: 'Diamante', 
                    price: 497, 
                    conv: '90%', 
                    delivery: 'Ilimitado* / Suporte VIP / Análise IA', 
                    profit: 99.40, 
                    color: 'text-blue-400',
                    depositValue: 497,
                    conversionFactor: 0.25,
                    benefits: ['Créditos Ilimitados*', 'Voz IA Ilimitada*', 'Suporte VIP', 'Análise IA Avançada'],
                    duration: '30 dias'
                  }
                ];
                for (const p of defaultPlans) {
                  await setDoc(doc(db, 'plans', p.id), p);
                }
              }
            } catch (error: any) {
              if (error.code === 'permission-denied') {
                handleFirestoreError(error, OperationType.GET, 'plans');
              }
            }
          }

          setIsVip(userData.isVip || false);
          setPlan(userData.plan || 'Bronze');
          setRole(userData.role || 'user');
          setCredits(userData.credits || 0);
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
    localStorage.removeItem('google_drive_token');
    localStorage.removeItem('google_drive_token_expiry');
    setGoogleAccessToken(null);
    setGoogleDriveConnected(false);
    await signOut(auth);
  };

  const connectGoogleDrive = async () => {
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/drive.file');
      
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      
      if (credential?.accessToken) {
        const token = credential.accessToken;
        const expiry = Date.now() + 3500 * 1000; // ~1 hour
        
        setGoogleAccessToken(token);
        setGoogleDriveConnected(true);
        localStorage.setItem('google_drive_token', token);
        localStorage.setItem('google_drive_token_expiry', expiry.toString());
        
        const { googleDriveService } = await import('./services/googleDrive');
        googleDriveService.setAccessToken(token);
        
        // Trigger initial sync
        await syncAllToGoogleDrive();
        
        alert('Google Drive conectado e sincronizado com sucesso!');
      }
    } catch (error: any) {
      console.error('Error connecting to Google Drive:', error);
      alert('Erro ao conectar ao Google Drive: ' + error.message);
    } finally {
      setSyncingToDrive(false);
    }
  };

  const syncAllToGoogleDrive = async () => {
    const token = localStorage.getItem('google_drive_token');
    if (!token || !user) return;

    try {
      setSyncingToDrive(true);
      const { googleDriveService } = await import('./services/googleDrive');
      const { localDb, syncItemToCloud } = await import('./db');
      
      googleDriveService.setAccessToken(token);
      
      const items = await localDb.items.where('userId').equals(user.uid).toArray();
      setSyncProgress({ current: 0, total: items.length });

      for (let i = 0; i < items.length; i++) {
        setSyncProgress({ current: i + 1, total: items.length });
        await syncItemToCloud(items[i]);
      }
      
      const now = new Date().toISOString();
      setLastSyncTime(now);
      localStorage.setItem('google_drive_last_sync', now);
      
      console.log('All items synced to Google Drive');
    } catch (error) {
      console.error('Error syncing all to Drive:', error);
    } finally {
      setSyncingToDrive(false);
      setSyncProgress(null);
    }
  };

  const unlockVip = async (code: string) => {
    if (!user) return false;
    const normalizedCode = code.trim().toUpperCase();
    if (normalizedCode === 'CACÁ61' || normalizedCode === 'CACA61') {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, { isVip: true, plan: 'Diamante', credits: 999999 }, { merge: true });
      setIsVip(true);
      setPlan('Diamante');
      setCredits(999999);
      sessionStorage.setItem('justUnlockedVip', 'true');
      window.dispatchEvent(new Event('vipUnlocked'));
      return true;
    }
    return false;
  };

  const spendCredits = async (amount: number, description: string) => {
    if (!user) return false;
    if (isVip) return true; // VIPs don't spend credits
    
    if (credits < amount) {
      alert(`Créditos insuficientes. Você precisa de ${amount} créditos para esta ação.`);
      return false;
    }

    try {
      const newCredits = credits - amount;
      const userRef = doc(db, 'users', user.uid);
      
      // Update credits
      await setDoc(userRef, { credits: newCredits }, { merge: true });
      
      // Log transaction
      const transactionRef = collection(db, 'users', user.uid, 'transactions');
      await addDoc(transactionRef, {
        amount: -amount,
        description,
        timestamp: Date.now(),
        type: 'usage'
      });

      setCredits(newCredits);
      return true;
    } catch (error) {
      console.error('Error spending credits:', error);
      return false;
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      signIn, 
      logOut, 
      isVip, 
      plan, 
      role, 
      unlockVip,
      maintenanceMode,
      forceUpdate,
      publishedVersion,
      betaMode,
      supportWhatsapp,
      defaultCredits,
      googleDriveConnected,
      connectGoogleDrive,
      syncAllToGoogleDrive,
      googleAccessToken,
      syncingToDrive,
      syncProgress,
      lastSyncTime,
      credits,
      spendCredits
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
