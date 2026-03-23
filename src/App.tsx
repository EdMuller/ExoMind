import React, { useState, useEffect } from 'react';
import { Mic, Keyboard, List, ArrowLeft, Settings as SettingsIcon, LogIn, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ActionSelector } from './components/ActionSelector';
import { NoteCapture } from './components/NoteCapture';
import { DocumentCapture } from './components/DocumentCapture';
import { LocationCapture } from './components/LocationCapture';
import { ScheduleCapture } from './components/ScheduleCapture';
import { ConsultChat } from './components/ConsultChat';
import { SavedItems } from './components/SavedItems';
import { Settings } from './components/Settings';
import { VipModal } from './components/VipModal';
import { BirthdaySurprise } from './components/BirthdaySurprise';
import { initAudio } from './utils/tts';
import { useAuth } from './AuthContext';

type InputMode = 'text' | 'voice' | null;
type ActionType = 'comentar' | 'fotografar' | 'salvar_local' | 'agendar' | 'consultar' | null;
type ViewState = 'home' | 'action_selector' | 'action_execute' | 'saved' | 'settings';

export default function App() {
  const { user, loading, signIn, logOut, isVip } = useAuth();
  const [view, setView] = useState<ViewState>('home');

  const [inputMode, setInputMode] = useState<InputMode>(null);
  const [action, setAction] = useState<ActionType>(null);
  const [appName, setAppName] = useState('ExoMind');
  const [showVipModal, setShowVipModal] = useState(false);

  useEffect(() => {
    if (user && !isVip && !sessionStorage.getItem('vipPromptShown')) {
      setShowVipModal(true);
      sessionStorage.setItem('vipPromptShown', 'true');
    }
  }, [user, isVip]);

  useEffect(() => {
    const updateAppIdentity = () => {
      const name = localStorage.getItem('appName') || 'ExoMind';
      const customIcon = localStorage.getItem('appIcon');
      setAppName(name);
      document.title = name;

      let manifestLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement;
      if (!manifestLink) {
        manifestLink = document.createElement('link');
        manifestLink.rel = 'manifest';
        document.head.appendChild(manifestLink);
      }

      const defaultIcon = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%233b82f6' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cpath d='M12 16v-4'/%3E%3Cpath d='M12 8h.01'/%3E%3C/svg%3E";
      const iconSrc = customIcon || defaultIcon;

      // Update favicon
      let favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
      if (!favicon) {
        favicon = document.createElement('link');
        favicon.rel = 'icon';
        document.head.appendChild(favicon);
      }
      favicon.href = iconSrc;

      const manifest = {
        name: name,
        short_name: name,
        start_url: "/",
        display: "standalone",
        background_color: "#0f172a",
        theme_color: "#0f172a",
        icons: [
          {
            src: iconSrc,
            sizes: "192x192",
            type: customIcon ? "image/png" : "image/svg+xml"
          },
          {
            src: iconSrc,
            sizes: "512x512",
            type: customIcon ? "image/png" : "image/svg+xml"
          }
        ]
      };
      const blob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
      manifestLink.href = URL.createObjectURL(blob);
    };

    updateAppIdentity();
    window.addEventListener('settingsUpdated', updateAppIdentity);
    return () => window.removeEventListener('settingsUpdated', updateAppIdentity);
  }, []);

  const handleSelectInputMode = (mode: InputMode) => {
    initAudio(); // Initialize audio context on user interaction
    setInputMode(mode);
    setView('action_selector');
  };

  const handleSelectAction = (selectedAction: ActionType) => {
    setAction(selectedAction);
    setView('action_execute');
  };

  const handleBack = () => {
    if (view === 'action_execute') {
      setAction(null);
      setView('action_selector');
    } else if (view === 'action_selector') {
      setInputMode(null);
      setView('home');
    } else if (view === 'saved' || view === 'settings') {
      setView('home');
    }
  };

  const handleSaved = () => {
    setAction(null);
    setInputMode(null);
    setView('home');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-200 flex flex-col items-center justify-center font-sans">
        <Loader2 className="animate-spin text-blue-500 mb-4" size={48} />
        <p className="text-slate-400">Carregando {appName}...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-200 flex flex-col items-center justify-center font-sans p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-slate-800 p-8 rounded-3xl border border-slate-700 shadow-2xl text-center"
        >
          <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Mic size={40} className="text-blue-400" />
          </div>
          <h1 className="text-3xl font-bold mb-2 text-white">Bem-vindo ao {appName}</h1>
          <p className="text-slate-400 mb-8">Seu segundo cérebro, agora na nuvem. Faça login para continuar.</p>
          
          <button
            onClick={signIn}
            className="w-full flex items-center justify-center gap-3 bg-white text-slate-900 py-4 px-6 rounded-xl font-semibold text-lg hover:bg-slate-100 transition-colors"
          >
            <LogIn size={24} />
            Entrar com Google
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 flex flex-col font-sans">
      {/* Header */}
      <header className="p-4 border-b border-slate-800 flex items-center justify-between glass-panel sticky top-0 z-10">
        <div className="flex items-center gap-3">
          {view !== 'home' && (
            <button onClick={handleBack} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
              <ArrowLeft size={20} />
            </button>
          )}
          <h1 className="text-xl font-semibold tracking-tight">{appName}</h1>
        </div>
        {view === 'home' && (
          <div className="flex items-center gap-2">
            <button onClick={() => setView('settings')} className="p-2 hover:bg-slate-800 rounded-full transition-colors" title="Configurações">
              <SettingsIcon size={20} />
            </button>
            <button onClick={() => setView('saved')} className="p-2 hover:bg-slate-800 rounded-full transition-colors" title="Ver Salvos">
              <List size={20} />
            </button>
          </div>
        )}
      </header>

      <VipModal isOpen={showVipModal} onClose={() => setShowVipModal(false)} />
      <BirthdaySurprise />

      {/* Main Content Area */}
      <main className="flex-1 relative overflow-hidden flex flex-col">
        <AnimatePresence mode="wait">
          {view === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex-1 flex flex-col items-center justify-center p-6 gap-6"
            >
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold mb-2 text-white">Como posso ajudar?</h2>
                <p className="text-slate-400">Escolha como deseja interagir hoje.</p>
              </div>

              <div className="grid grid-cols-2 gap-4 w-full max-w-md">
                <button
                  onClick={() => handleSelectInputMode('text')}
                  className="flex flex-col items-center justify-center p-8 bg-slate-800 hover:bg-slate-700 rounded-2xl border border-slate-700 transition-all shadow-lg"
                >
                  <Keyboard size={48} className="mb-4 text-blue-400" />
                  <span className="font-medium text-lg">Digitar</span>
                </button>
                <button
                  onClick={() => handleSelectInputMode('voice')}
                  className="flex flex-col items-center justify-center p-8 bg-slate-800 hover:bg-slate-700 rounded-2xl border border-slate-700 transition-all shadow-lg"
                >
                  <Mic size={48} className="mb-4 text-emerald-400" />
                  <span className="font-medium text-lg">Falar</span>
                </button>
              </div>

              <div className="mt-auto pt-12 pb-4 opacity-30">
                <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-slate-500">ExoMind v1.0.5</p>
              </div>
            </motion.div>
          )}

          {view === 'action_selector' && inputMode && (
            <ActionSelector 
              inputMode={inputMode} 
              onSelectAction={handleSelectAction} 
            />
          )}

          {view === 'action_execute' && action === 'comentar' && inputMode && (
            <NoteCapture inputMode={inputMode} onSaved={handleSaved} onCancel={handleBack} />
          )}

          {view === 'action_execute' && action === 'fotografar' && (
            <DocumentCapture onSaved={handleSaved} onCancel={handleBack} />
          )}

          {view === 'action_execute' && action === 'salvar_local' && (
            <LocationCapture onSaved={handleSaved} onCancel={handleBack} />
          )}

          {view === 'action_execute' && action === 'agendar' && inputMode === 'voice' && (
            <NoteCapture inputMode={inputMode} onSaved={handleSaved} onCancel={handleBack} />
          )}

          {view === 'action_execute' && action === 'agendar' && inputMode === 'text' && (
            <ScheduleCapture inputMode={inputMode} onSaved={handleSaved} onCancel={handleBack} />
          )}

          {view === 'action_execute' && action === 'consultar' && inputMode && (
            <ConsultChat inputMode={inputMode} onClose={handleSaved} />
          )}

          {view === 'saved' && <SavedItems />}
          {view === 'settings' && <Settings onClose={handleSaved} />}
        </AnimatePresence>
      </main>
    </div>
  );
}
