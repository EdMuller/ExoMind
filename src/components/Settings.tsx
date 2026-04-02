import React, { useState } from 'react';
import { useAuth } from '../AuthContext';
import { updateDoc, doc } from 'firebase/firestore';
import { db, logout } from '../firebase';
import { 
  User, 
  Bell, 
  Shield, 
  Database, 
  LogOut, 
  Save, 
  Loader2, 
  CheckCircle2,
  AlertCircle,
  Smartphone,
  Globe,
  Moon,
  Sun,
  Layout
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Settings: React.FC = () => {
  const { profile } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    displayName: profile?.displayName || '',
    email: profile?.email || '',
    notifications: true,
    darkMode: true,
    language: 'pt-BR'
  });

  const handleSave = async () => {
    if (!profile) return;
    setIsSaving(true);
    setError(null);
    setSuccess(false);
    
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        displayName: formData.displayName,
        // Outras configurações poderiam ser salvas aqui
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error("Erro ao salvar configurações:", err);
      setError("Falha ao salvar as alterações.");
    } finally {
      setIsSaving(false);
    }
  };

  const sections = [
    { id: 'profile', icon: User, label: 'Perfil' },
    { id: 'notifications', icon: Bell, label: 'Notificações' },
    { id: 'security', icon: Shield, label: 'Segurança' },
    { id: 'data', icon: Database, label: 'Dados e Armazenamento' },
  ];

  const [activeSection, setActiveSection] = useState('profile');

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-2xl font-bold text-zinc-100">Configurações</h3>
          <p className="text-zinc-400">Gerencie sua conta e preferências do sistema.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar Alterações
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar Settings */}
        <aside className="w-full md:w-64 space-y-2">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeSection === section.id 
                  ? 'bg-zinc-800 text-indigo-400 border border-zinc-700' 
                  : 'text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300'
              }`}
            >
              <section.icon className="w-5 h-5" />
              <span className="font-medium">{section.label}</span>
            </button>
          ))}
          <div className="pt-4 mt-4 border-t border-zinc-800">
            <button
              onClick={logout}
              className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-400/5 rounded-xl transition-all"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Encerrar Sessão</span>
            </button>
          </div>
        </aside>

        {/* Content Settings */}
        <div className="flex-1 space-y-6">
          <AnimatePresence mode="wait">
            {activeSection === 'profile' && (
              <motion.div
                key="profile"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 space-y-8"
              >
                <div className="flex items-center gap-6">
                  <div className="relative group">
                    <div className="w-24 h-24 rounded-full bg-indigo-500/10 border-2 border-indigo-500/20 flex items-center justify-center overflow-hidden">
                      {profile?.photoURL ? (
                        <img src={profile.photoURL} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-10 h-10 text-indigo-400" />
                      )}
                    </div>
                    <button className="absolute bottom-0 right-0 p-2 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-500 transition-all">
                      <Smartphone className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xl font-bold text-zinc-100">{profile?.displayName}</h4>
                    <p className="text-zinc-500 text-sm">Membro desde {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : 'N/A'}</p>
                    <div className="flex gap-2 pt-2">
                      <span className="px-2 py-1 bg-indigo-500/10 text-indigo-400 text-[10px] font-bold uppercase tracking-widest rounded-md border border-indigo-500/20">
                        {profile?.role}
                      </span>
                      {profile?.isVip && (
                        <span className="px-2 py-1 bg-amber-500/10 text-amber-400 text-[10px] font-bold uppercase tracking-widest rounded-md border border-amber-500/20">
                          VIP
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Nome de Exibição</label>
                    <input
                      type="text"
                      value={formData.displayName}
                      onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-100 focus:border-indigo-500 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">E-mail</label>
                    <input
                      type="email"
                      value={formData.email}
                      disabled
                      className="w-full bg-zinc-800/50 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-500 cursor-not-allowed"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {activeSection === 'notifications' && (
              <motion.div
                key="notifications"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 space-y-6"
              >
                <h4 className="text-xl font-bold text-zinc-100 mb-6">Preferências de Notificação</h4>
                {[
                  { id: 'push', label: 'Notificações Push', desc: 'Receba alertas sobre novas capturas e lembretes.' },
                  { id: 'email', label: 'E-mails Semanais', desc: 'Resumo da sua produtividade e insights da IA.' },
                  { id: 'updates', label: 'Atualizações do Sistema', desc: 'Fique por dentro de novas funcionalidades.' },
                ].map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-2xl border border-zinc-800">
                    <div className="space-y-1">
                      <p className="font-bold text-zinc-100">{item.label}</p>
                      <p className="text-xs text-zinc-500">{item.desc}</p>
                    </div>
                    <div className="w-12 h-6 bg-indigo-600 rounded-full relative cursor-pointer">
                      <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm" />
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {success && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3 text-emerald-400"
            >
              <CheckCircle2 className="w-5 h-5" />
              Configurações salvas com sucesso!
            </motion.div>
          )}

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-400">
              <AlertCircle className="w-5 h-5" />
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
