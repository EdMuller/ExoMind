import React, { useState } from 'react';
import { useAuth } from '../AuthContext';
import { logout } from '../firebase';
import { 
  LayoutDashboard, 
  MessageSquare, 
  Mic, 
  FileText, 
  Settings as SettingsIcon, 
  LogOut, 
  Plus, 
  Search, 
  Bell,
  User,
  Menu,
  X,
  Sparkles,
  Video,
  Database,
  Shield
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import Chat from './Chat';
import SavedItems from './SavedItems';
import AudioRecorder from './AudioRecorder';
import DocumentCapture from './DocumentCapture';
import VideoRecorder from './VideoRecorder';
import Settings from './Settings';
import AdminPanel from './AdminPanel';

const Dashboard: React.FC = () => {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const menuItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Painel' },
    { id: 'chat', icon: MessageSquare, label: 'Chat de IA' },
    { id: 'audio', icon: Mic, label: 'Gravador de Voz' },
    { id: 'video', icon: Video, label: 'Gravador de Vídeo' },
    { id: 'documents', icon: FileText, label: 'Documentos' },
    { id: 'saved', icon: Database, label: 'Minhas Capturas' },
    { id: 'settings', icon: SettingsIcon, label: 'Configurações' },
  ];

  if (profile?.role === 'admin') {
    menuItems.push({ id: 'admin', icon: Shield, label: 'Admin' });
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { label: 'Total de Capturas', value: '128', color: 'indigo' },
                { label: 'Horas de Áudio', value: '12.5h', color: 'emerald' },
                { label: 'Documentos IA', value: '45', color: 'rose' },
              ].map((stat, i) => (
                <div key={i} className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl space-y-2">
                  <p className="text-zinc-500 text-sm font-medium">{stat.label}</p>
                  <p className="text-3xl font-bold">{stat.value}</p>
                </div>
              ))}
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 text-center space-y-4">
              <div className="w-16 h-16 bg-indigo-500/10 rounded-2xl flex items-center justify-center mx-auto">
                <Sparkles className="w-8 h-8 text-indigo-400" />
              </div>
              <h3 className="text-xl font-bold">Bem-vindo de volta, {profile?.displayName}!</h3>
              <p className="text-zinc-400 max-w-md mx-auto">
                Seu assistente holístico está pronto para ajudar você a organizar suas ideias e produtividade.
              </p>
            </div>
          </div>
        );
      case 'chat':
        return <Chat />;
      case 'audio':
        return <AudioRecorder />;
      case 'video':
        return <VideoRecorder />;
      case 'documents':
        return <DocumentCapture />;
      case 'saved':
        return <SavedItems />;
      case 'settings':
        return <Settings />;
      case 'admin':
        return <AdminPanel />;
      default:
        return (
          <div className="flex flex-col items-center justify-center h-[60vh] text-zinc-500 space-y-4">
            <div className="p-4 bg-zinc-900 rounded-full">
              <LayoutDashboard className="w-12 h-12 opacity-20" />
            </div>
            <p className="text-lg">Módulo "{activeTab}" em restauração...</p>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex overflow-hidden">
      {/* Sidebar */}
      <AnimatePresence mode="wait">
        {isSidebarOpen && (
          <motion.aside 
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            className="w-72 bg-zinc-900 border-r border-zinc-800 flex flex-col z-50 fixed inset-y-0 lg:relative"
          >
            <div className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/10 rounded-xl">
                  <Sparkles className="w-6 h-6 text-indigo-400" />
                </div>
                <span className="font-bold text-xl tracking-tight">Holístico</span>
              </div>
              <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 hover:bg-zinc-800 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 px-4 space-y-2 mt-4">
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                    activeTab === item.id 
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                      : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </button>
              ))}
            </nav>

            <div className="p-4 border-t border-zinc-800 space-y-4">
              <div className="flex items-center gap-3 px-4 py-3 bg-zinc-800/50 rounded-2xl">
                <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center overflow-hidden border border-indigo-500/30">
                  {profile?.photoURL ? (
                    <img src={profile.photoURL} alt={profile.displayName} referrerPolicy="no-referrer" />
                  ) : (
                    <User className="w-5 h-5 text-indigo-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{profile?.displayName}</p>
                  <p className="text-xs text-zinc-500 truncate">{profile?.email}</p>
                </div>
              </div>
              <button 
                onClick={logout}
                className="w-full flex items-center gap-3 px-4 py-3 text-zinc-400 hover:text-red-400 hover:bg-red-400/5 rounded-xl transition-all"
              >
                <LogOut className="w-5 h-5" />
                <span className="font-medium">Sair</span>
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 relative">
        {/* Top Bar */}
        <header className="h-20 border-b border-zinc-800 flex items-center justify-between px-8 bg-zinc-950/50 backdrop-blur-xl sticky top-0 z-40">
          <div className="flex items-center gap-4">
            {!isSidebarOpen && (
              <button onClick={() => setIsSidebarOpen(true)} className="p-2 hover:bg-zinc-900 rounded-lg">
                <Menu className="w-6 h-6" />
              </button>
            )}
            <h2 className="text-xl font-bold capitalize">{activeTab}</h2>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl w-64">
              <Search className="w-4 h-4 text-zinc-500" />
              <input 
                type="text" 
                placeholder="Pesquisar..." 
                className="bg-transparent border-none outline-none text-sm w-full"
              />
            </div>
            <button className="p-2 hover:bg-zinc-900 rounded-xl relative">
              <Bell className="w-5 h-5 text-zinc-400" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-indigo-500 rounded-full border-2 border-zinc-950"></span>
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition-all shadow-lg shadow-indigo-600/20">
              <Plus className="w-4 h-4" />
              <span>Novo</span>
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-6xl mx-auto">
            {renderContent()}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
