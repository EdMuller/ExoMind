import React, { useState, useEffect, useRef } from 'react';
import { Settings as SettingsIcon, Download, Upload, Cloud, Bell, Save, CheckCircle2, AlertCircle, User, Image as ImageIcon, Video, Mic, Volume2, Loader2, LogOut, Share2, FileText, QrCode, X, Smartphone, Globe, Shield, RefreshCw, CheckCircle, MessageCircle, HelpCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { getAI } from '../utils/ai';
import { Modality } from '@google/genai';
import { getItems, importItems } from '../db';
import { initAudio, getAudioContext } from '../utils/tts';
import { useAuth } from '../AuthContext';
import { APP_VERSION } from '../constants';

interface SettingsProps {
  onClose?: () => void;
  onAdminPanel?: () => void;
}

export function Settings({ onClose, onAdminPanel }: SettingsProps) {
  const { 
    user, 
    logOut, 
    plan, 
    role, 
    publishedVersion,
    googleDriveConnected,
    connectGoogleDrive,
    syncAllToGoogleDrive,
    syncingToDrive,
    syncProgress,
    lastSyncTime,
    supportWhatsapp
  } = useAuth();
  const [appName, setAppName] = useState('ExoMind');
  const [userName, setUserName] = useState('');
  const [customAiInstructions, setCustomAiInstructions] = useState('');
  const [appIcon, setAppIcon] = useState<string | null>(null);
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'up-to-date' | 'available'>('idle');

  const checkUpdates = () => {
    setUpdateStatus('checking');
    setTimeout(() => {
      if (publishedVersion !== APP_VERSION) {
        setUpdateStatus('available');
      } else {
        setUpdateStatus('up-to-date');
      }
    }, 1500);
  };
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [backupMode, setBackupMode] = useState<'automatic' | 'manual'>('manual');
  const [backupInterval, setBackupInterval] = useState<number>(7);
  const [selectedVoice, setSelectedVoice] = useState('Zephyr');
  const [voiceRate, setVoiceRate] = useState(1.0);
  const [webSearchEnabled, setWebSearchEnabled] = useState(localStorage.getItem('exo_web_search') === 'true');
  const [handsFreeEnabled, setHandsFreeEnabled] = useState(localStorage.getItem('exo_voice_hands_free') === 'true');
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isSuccess, setIsSuccess] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else {
      alert("Para instalar o ExoMind:\n\nNo Android: Toque nos três pontos do navegador e selecione 'Instalar aplicativo'.\n\nNo iOS (iPhone): Toque no botão de compartilhar e selecione 'Adicionar à Tela de Início'.");
    }
  };
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState<'json' | 'txt' | 'csv'>('txt');
  const [exportItems, setExportItems] = useState<string[]>([]); // IDs of items to export
  const [isExporting, setIsExporting] = useState(false);
  const [availableItems, setAvailableItems] = useState<any[]>([]);

  useEffect(() => {
    if (showExportModal) {
      getItems().then(setAvailableItems);
    }
  }, [showExportModal]);

  useEffect(() => {
    // Load settings from localStorage
    setAppName(localStorage.getItem('appName') || 'ExoMind');
    setUserName(localStorage.getItem('userName') || '');
    setCustomAiInstructions(localStorage.getItem('customAiInstructions') || '');
    setAppIcon(localStorage.getItem('appIcon') || null);
    setReminderEnabled(localStorage.getItem('backupReminderEnabled') === 'true');
    setBackupMode((localStorage.getItem('backupMode') as 'automatic' | 'manual') || 'manual');
    setBackupInterval(parseInt(localStorage.getItem('backupInterval') || '7', 10));
    setSelectedVoice(localStorage.getItem('exo_voice_preference') || 'Zephyr');
    setVoiceRate(parseFloat(localStorage.getItem('exo_voice_rate') || '1.0'));
    setWebSearchEnabled(localStorage.getItem('exo_web_search') === 'true');
    setHandsFreeEnabled(localStorage.getItem('exo_voice_hands_free') === 'true');
  }, []);

  const showStatus = (type: 'success' | 'error', message: string) => {
    setStatus({ type, message });
    setTimeout(() => setStatus({ type: null, message: '' }), 3000);
  };

  const handleSaveSettings = () => {
    localStorage.setItem('appName', appName);
    localStorage.setItem('userName', userName);
    localStorage.setItem('customAiInstructions', customAiInstructions);
    if (appIcon) localStorage.setItem('appIcon', appIcon);
    localStorage.setItem('backupReminderEnabled', reminderEnabled.toString());
    localStorage.setItem('backupMode', backupMode);
    localStorage.setItem('backupInterval', backupInterval.toString());
    localStorage.setItem('exo_voice_preference', selectedVoice);
    localStorage.setItem('exo_voice_rate', voiceRate.toString());
    localStorage.setItem('exo_web_search', webSearchEnabled.toString());
    localStorage.setItem('exo_voice_hands_free', handsFreeEnabled.toString());
    window.dispatchEvent(new Event('settingsUpdated'));
    
    setIsSuccess(true);
    setTimeout(() => {
      if (onClose) {
        onClose();
      }
    }, 1500);
  };

  const downloadFile = (dataStr: string, mimeType: string, filename: string) => {
    const dataBlob = new Blob([dataStr], { type: mimeType });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleBackup = async () => {
    try {
      const items = await getItems();
      const dateStr = new Date().toISOString().split('T')[0];
      
      // Native JSON backup (Always)
      const jsonStr = JSON.stringify(items, null, 2);
      downloadFile(jsonStr, 'application/json', `exomind-native-backup-${dateStr}.json`);

      // If Ouro or Diamante, also export TXT and CSV automatically
      if (plan === 'Ouro' || plan === 'Diamante') {
        // TXT
        const txtStr = items.map(i => {
          const date = new Date(i.timestamp).toLocaleString('pt-BR');
          return `Data: ${date}\nTipo: ${i.type.toUpperCase()}\nConteúdo:\n${i.content}\n----------------------------------------\n`;
        }).join('\n');
        downloadFile(txtStr, 'text/plain', `exomind-readable-backup-${dateStr}.txt`);

        // CSV
        const headers = ['ID', 'Data', 'Tipo', 'Conteúdo', 'Descrição'];
        const rows = items.map(i => [
          i.id,
          new Date(i.timestamp).toISOString(),
          i.type,
          `"${(i.content || '').toString().replace(/"/g, '""')}"`,
          `"${(i.metadata?.description || '').toString().replace(/"/g, '""')}"`
        ]);
        const csvStr = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        downloadFile(csvStr, 'text/csv', `exomind-data-backup-${dateStr}.csv`);
      }

      localStorage.setItem('lastBackupDate', Date.now().toString());
      showStatus('success', 'Backup realizado com sucesso!');
    } catch (error) {
      console.error('Error during backup:', error);
      showStatus('error', 'Erro ao realizar backup.');
    }
  };

  const handleExportCustom = async () => {
    if (plan === 'Bronze' || plan === 'Prata') {
      showStatus('error', 'A exportação personalizada é um recurso Ouro/Diamante. Faça um upgrade para garantir total portabilidade!');
      return;
    }
    
    try {
      const allItems = await getItems();
      const selectedItems = allItems.filter(i => exportItems.length === 0 || exportItems.includes(i.id));
      
      let dataStr = '';
      let mimeType = '';
      let extension = '';

      if (exportFormat === 'json') {
        dataStr = JSON.stringify(selectedItems, null, 2);
        mimeType = 'application/json';
        extension = 'json';
      } else if (exportFormat === 'csv') {
        const headers = ['ID', 'Data', 'Tipo', 'Conteúdo', 'Descrição'];
        const rows = selectedItems.map(i => [
          i.id,
          new Date(i.timestamp).toISOString(),
          i.type,
          `"${(i.content || '').toString().replace(/"/g, '""')}"`,
          `"${(i.metadata?.description || '').toString().replace(/"/g, '""')}"`
        ]);
        dataStr = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        mimeType = 'text/csv';
        extension = 'csv';
      } else {
        dataStr = selectedItems.map(i => {
          const date = new Date(i.timestamp).toLocaleString('pt-BR');
          return `Data: ${date}\nTipo: ${i.type.toUpperCase()}\nConteúdo:\n${i.content}\n----------------------------------------\n`;
        }).join('\n');
        mimeType = 'text/plain';
        extension = 'txt';
      }

      downloadFile(dataStr, mimeType, `exomind-export-${new Date().toISOString().split('T')[0]}.${extension}`);
      showStatus('success', 'Exportação concluída!');
      setShowExportModal(false);
    } catch (error) {
      console.error('Error during custom export:', error);
      showStatus('error', 'Erro ao exportar dados.');
    }
  };

  const handleShareWhatsApp = () => {
    const appUrl = window.location.origin;
    const text = `Conheça o ExoMind, seu segundo cérebro na nuvem! Acesse: ${appUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const items = JSON.parse(content);
        if (Array.isArray(items)) {
          await importItems(items);
          showStatus('success', 'Backup restaurado com sucesso!');
        } else {
          showStatus('error', 'Formato de arquivo inválido.');
        }
      } catch (error) {
        console.error('Error importing backup:', error);
        showStatus('error', 'Erro ao ler o arquivo de backup.');
      }
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const handleIconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setAppIcon(base64);
    };
    reader.readAsDataURL(file);
  };

  const handlePreviewVoice = async () => {
    if (isPreviewing) return;
    setIsPreviewing(true);
    initAudio();
    try {
      const text = "Parabéns, Você está conhecendo seu mais recente e mais completo assistente diário para todos os assuntos.";
      if (selectedVoice === 'personal_voice') {
        // Personal voice logic for Diamond users
        showStatus('success', 'A Voz Pessoal permite que você clone sua própria voz. Este recurso está disponível para usuários Diamante.');
        setIsPreviewing(false);
        return;
      } else {
        const ai = getAI();
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash-preview-tts",
          contents: [{ parts: [{ text: text }] }],
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: selectedVoice },
              },
            },
          },
        });

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Audio) {
          const binaryString = atob(base64Audio);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          
          const audioCtx = getAudioContext();
          let audioBuffer: AudioBuffer;

          try {
            // Try decoding as a standard container (WAV, MP3, etc.)
            audioBuffer = await new Promise<AudioBuffer>((resolveDecode, rejectDecode) => {
              const decodePromise = audioCtx.decodeAudioData(
                bytes.buffer.slice(0),
                (decoded) => resolveDecode(decoded),
                (err) => rejectDecode(err)
              );
              if (decodePromise) {
                decodePromise.catch(rejectDecode);
              }
            });
          } catch (decodeError) {
            // Fallback: Assume raw 16-bit Linear PCM (24kHz)
            console.warn('Standard decoding failed, attempting raw PCM playback', decodeError);
            const pcmLength = Math.floor(len / 2);
            audioBuffer = audioCtx.createBuffer(1, pcmLength, 24000);
            const channelData = audioBuffer.getChannelData(0);
            const dataView = new DataView(bytes.buffer);
            for (let i = 0; i < pcmLength; i++) {
              channelData[i] = dataView.getInt16(i * 2, true) / 32768.0;
            }
          }

          if (audioCtx.state === 'suspended') {
            audioCtx.resume().catch(console.error);
          }

          const source = audioCtx.createBufferSource();
          source.buffer = audioBuffer;
          source.playbackRate.value = voiceRate;
          source.connect(audioCtx.destination);
          source.start();
          source.onended = () => {
            setIsPreviewing(false);
          };
        } else {
          setIsPreviewing(false);
        }
      }
    } catch (error) {
      console.error('Error previewing voice:', error);
      setIsPreviewing(false);
      showStatus('error', 'Erro ao reproduzir prévia da voz.');
    }
  };

  const toggleItemSelection = (id: string) => {
    setExportItems(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  return (
    <motion.div
      key="settings"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex-1 flex flex-col h-full absolute inset-0 bg-slate-900 overflow-y-auto p-4 z-20"
    >
      <div className="max-w-md mx-auto w-full pb-20">
        <div className="flex items-center gap-3 mb-8 mt-4">
          <SettingsIcon size={28} className="text-slate-400" />
          <h2 className="text-2xl font-bold text-white">Configurações</h2>
        </div>

        {status.type && (
          <div className={`p-4 rounded-xl mb-6 flex items-center gap-3 ${status.type === 'success' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
            {status.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            <span className="font-medium text-sm">{status.message}</span>
          </div>
        )}

        <div className="space-y-8">
          {/* User Profile Section */}
          <section className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <User size={20} className="text-blue-400" />
              Sua Conta
            </h3>
            <div className="flex items-center gap-4 mb-6">
              {user?.photoURL ? (
                <img src={user.photoURL} alt="Profile" className="w-12 h-12 rounded-full border border-slate-600" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center border border-slate-600">
                  <User size={24} className="text-slate-400" />
                </div>
              )}
              <div className="flex-1 overflow-hidden">
                <p className="text-white font-medium truncate">{user?.displayName || 'Usuário'}</p>
                <p className="text-slate-400 text-sm truncate">{user?.email}</p>
              </div>
            </div>
            
            <div className="flex flex-col gap-2">
              {role === 'admin' && onAdminPanel && (
                <button
                  onClick={onAdminPanel}
                  className="w-full flex items-center justify-center gap-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 py-3 px-4 rounded-xl font-bold transition-colors"
                >
                  <Shield size={18} />
                  Painel Administrativo
                </button>
              )}
              
              <button
                onClick={logOut}
                className="w-full flex items-center justify-center gap-2 bg-slate-700/50 text-slate-400 hover:bg-slate-700 border border-slate-700 py-3 px-4 rounded-xl font-medium transition-colors"
              >
                <LogOut size={18} />
                Sair da conta
              </button>
            </div>
          </section>

          {/* Version Section */}
          <section className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <RefreshCw size={20} className="text-emerald-400" />
                Versão do App
              </h3>
              <span className="text-xs font-mono text-slate-500 bg-slate-900 px-2 py-1 rounded border border-slate-700">
                v{APP_VERSION}
              </span>
            </div>
            
            <div className="flex flex-col gap-3">
              <button
                onClick={checkUpdates}
                disabled={updateStatus === 'checking'}
                className="w-full flex items-center justify-center gap-2 bg-slate-700/50 text-slate-200 hover:bg-slate-700 border border-slate-700 py-3 px-4 rounded-xl font-medium transition-colors disabled:opacity-50"
              >
                {updateStatus === 'checking' ? (
                  <RefreshCw size={18} className="animate-spin" />
                ) : (
                  <RefreshCw size={18} />
                )}
                Verificar Atualizações
              </button>

              {updateStatus === 'up-to-date' && (
                <div className="flex items-center gap-2 text-emerald-400 text-sm justify-center bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20">
                  <CheckCircle size={16} />
                  O app está atualizado!
                </div>
              )}

              {updateStatus === 'available' && (
                <div className="flex flex-col gap-2 p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                  <div className="flex items-center gap-2 text-blue-400 text-sm font-bold">
                    <AlertCircle size={16} />
                    Nova versão disponível: v{publishedVersion}
                  </div>
                  <p className="text-xs text-slate-400">
                    Recarregue a página ou reinicie o app para atualizar.
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Personalization Section */}
          <section className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <User size={20} className="text-purple-400" />
              Personalização
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Nome do Assistente</label>
                <input
                  type="text"
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  placeholder="Ex: ExoMind, Jarvis, Sexta-feira"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Seu Nome</label>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Como devo chamar você?"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Instruções Personalizadas da IA</label>
                <textarea
                  value={customAiInstructions}
                  onChange={(e) => setCustomAiInstructions(e.target.value)}
                  placeholder="Ex: Sempre me chame de 'Comandante'. Use respostas curtas e diretas. Se eu falar sobre trabalho, use um tom mais formal."
                  rows={4}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-sm resize-none"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Essas instruções moldam como a IA interage com você.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Ícone do Aplicativo</label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                    {appIcon ? (
                      <img src={appIcon} alt="App Icon" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon size={24} className="text-slate-500" />
                    )}
                  </div>
                  <label className="cursor-pointer bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors">
                    Escolher Imagem
                    <input type="file" accept="image/*" className="hidden" onChange={handleIconUpload} />
                  </label>
                </div>
              </div>
            </div>
          </section>

          {/* Voice Settings Section */}
          <section className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Mic size={20} className="text-emerald-400" />
              Voz do Assistente
            </h3>
            <p className="text-slate-400 text-sm mb-4">
              Escolha a voz que o assistente usará para falar com você. Clique no ícone de som para ouvir uma prévia.
            </p>
            <div className="flex gap-2">
              <select
                value={selectedVoice}
                onChange={(e) => setSelectedVoice(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
              >
                <option value="Zephyr">Zephyr (Feminina - Profissional)</option>
                <option value="Kore">Kore (Feminina - Calma)</option>
                <option value="Puck">Puck (Masculina/Neutra - Descontraída)</option>
                <option value="Charon">Charon (Masculina - Grave)</option>
                <option value="Fenrir">Fenrir (Masculina - Enérgica)</option>
                <option value="personal_voice" disabled={plan !== 'Diamante'}>
                  Voz Pessoal (Diamante) {plan !== 'Diamante' ? '- Requer Plano Diamante' : ''}
                </option>
              </select>
              <button
                onClick={handlePreviewVoice}
                disabled={isPreviewing || (selectedVoice === 'personal_voice' && plan !== 'Diamante')}
                className={`p-3 rounded-lg border transition-colors flex items-center justify-center min-w-[48px] ${
                  isPreviewing 
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' 
                    : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-emerald-500 hover:text-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed'
                }`}
                title="Ouvir prévia"
              >
                {isPreviewing ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <Volume2 size={20} />
                )}
              </button>
            </div>

            <div className="mt-6">
              <label className="block text-sm font-medium text-slate-400 mb-2 flex justify-between">
                <span>Velocidade da Voz</span>
                <span className="text-emerald-400 font-mono">{voiceRate.toFixed(1)}x</span>
              </label>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500">0.5x</span>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={voiceRate}
                  onChange={(e) => setVoiceRate(parseFloat(e.target.value))}
                  className="flex-1 h-2 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <span className="text-xs text-slate-500">2.0x</span>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Mic size={18} className="text-emerald-400" />
                  <span className="text-sm font-medium text-white">Modo Conversa Contínua (Mãos Livres)</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={handsFreeEnabled}
                    onChange={(e) => setHandsFreeEnabled(e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>
              <p className="text-[10px] text-amber-400/70 italic mt-1">
                * Recurso experimental. Recomendado apenas para vozes nativas (Zephyr, Kore, etc) para melhor performance.
              </p>
            </div>

            <div className="mt-6 pt-6 border-t border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Globe size={18} className="text-blue-400" />
                  <span className="text-sm font-medium text-white">Busca na Web (Google Search)</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={webSearchEnabled}
                    onChange={(e) => setWebSearchEnabled(e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
              <p className="text-xs text-slate-500">
                Permite que o ExoMind busque informações em tempo real na internet (clima, notícias, músicas, etc).
              </p>
            </div>
          </section>

          {/* Data Management Section */}
          <section className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Download size={20} className="text-emerald-400" />
              Gestão de Dados
            </h3>
            
            <div className="grid grid-cols-1 gap-3">
              <button
                onClick={() => setShowExportModal(true)}
                className="flex items-center gap-4 p-4 bg-slate-900 border border-slate-700 hover:border-emerald-500 text-white rounded-xl transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                  <FileText size={20} />
                </div>
                <div className="text-left">
                  <span className="block font-bold">Exportar Dados</span>
                  <span className="text-xs text-slate-400">Escolha arquivos ou pastas completas</span>
                </div>
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-4 p-4 bg-slate-900 border border-slate-700 hover:border-purple-500 text-white rounded-xl transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400">
                  <Upload size={20} />
                </div>
                <div className="text-left">
                  <span className="block font-bold">Restaurar Backup</span>
                  <span className="text-xs text-slate-400">Importar dados de um arquivo JSON</span>
                </div>
              </button>
              <input type="file" ref={fileInputRef} onChange={handleImport} accept=".json" className="hidden" />
            </div>
          </section>

          {/* Google Drive Integration Section */}
          <section className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Cloud size={20} className="text-blue-400" />
              Sincronização com Google Drive
            </h3>
            
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mb-6">
              <p className="text-blue-200 text-sm leading-relaxed">
                <strong>Privacidade Total:</strong> Ao conectar seu Google Drive, o ExoMind salvará uma cópia de todos os seus dados diretamente na sua conta Google. Nós <strong>não</strong> temos acesso a esses arquivos fora do aplicativo.
              </p>
            </div>

            <div className="space-y-4">
              {googleDriveConnected ? (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
                    {syncingToDrive ? (
                      <RefreshCw size={24} className="animate-spin" />
                    ) : (
                      <CheckCircle size={24} />
                    )}
                    <div className="flex-1">
                      <p className="font-bold text-sm">
                        {syncingToDrive ? 'Sincronizando...' : 'Google Drive Conectado'}
                      </p>
                      <p className="text-xs opacity-80 text-emerald-300/70">
                        {syncingToDrive && syncProgress 
                          ? `Sincronizando item ${syncProgress.current} de ${syncProgress.total}...`
                          : lastSyncTime 
                            ? `Última sincronização: ${new Date(lastSyncTime).toLocaleString('pt-BR')}`
                            : 'Seus dados estão sendo sincronizados com a pasta "ExoMind".'}
                      </p>
                    </div>
                  </div>

                  {syncingToDrive && syncProgress && (
                    <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
                      <motion.div 
                        className="bg-emerald-500 h-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${(syncProgress.current / syncProgress.total) * 100}%` }}
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={syncAllToGoogleDrive}
                      disabled={syncingToDrive}
                      className="py-3 px-4 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <RefreshCw size={16} className={syncingToDrive ? 'animate-spin' : ''} />
                      Sincronizar Tudo
                    </button>
                    <button
                      onClick={connectGoogleDrive}
                      disabled={syncingToDrive}
                      className="py-3 px-4 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <Share2 size={16} />
                      Trocar Conta
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={connectGoogleDrive}
                  className="w-full flex items-center justify-center gap-3 bg-white text-slate-900 py-4 px-6 rounded-xl font-bold text-lg hover:bg-slate-100 transition-all shadow-lg shadow-white/10"
                >
                  <Cloud size={24} />
                  Conectar Google Drive
                </button>
              )}
              
              <p className="text-xs text-slate-500 text-center px-4">
                O ExoMind solicitará permissão apenas para criar e editar os arquivos que ele mesmo criar no seu Drive.
              </p>
            </div>
          </section>

          {/* Install Section */}
          <section className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Smartphone size={20} className="text-emerald-400" />
              Instalar Aplicativo
            </h3>
            <p className="text-slate-400 text-sm mb-6">
              Instale o ExoMind na sua tela de início para acesso rápido e uma experiência de tela cheia.
            </p>
            
            <button
              onClick={handleInstallApp}
              className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-950 text-white py-3 px-4 rounded-xl font-medium border border-slate-700 transition-colors"
            >
              <Download size={18} />
              {deferredPrompt ? 'Instalar Agora' : 'Como Instalar'}
            </button>
          </section>

          {/* Support Section */}
          <section className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <HelpCircle size={20} className="text-blue-400" />
              Suporte & Ajuda
            </h3>
            <p className="text-slate-400 text-sm mb-6">
              Precisa de ajuda ou quer dar um feedback? Nossa equipe está pronta para te atender.
            </p>
            
            <a
              href={`https://wa.me/${supportWhatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20bd5a] text-white py-4 px-6 rounded-xl font-bold text-lg transition-all shadow-lg shadow-green-900/20 active:scale-[0.98]"
            >
              <MessageCircle size={24} />
              Falar com Suporte
            </a>
          </section>

          {/* Share Section */}
          <section className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Share2 size={20} className="text-pink-400" />
              Compartilhar ExoMind
            </h3>
            <p className="text-slate-400 text-sm mb-6">
              Gostou do ExoMind? Compartilhe com seus amigos para que eles também tenham um segundo cérebro.
            </p>
            
            <div className="flex flex-col items-center gap-6">
              <div className="bg-white p-4 rounded-2xl shadow-lg">
                <QRCodeSVG 
                  value={window.location.origin} 
                  size={160}
                  bgColor={"#ffffff"}
                  fgColor={"#0f172a"}
                  level={"L"}
                  includeMargin={false}
                />
              </div>
              <p className="text-sm text-slate-400">Escaneie o QR Code acima</p>
              
              <button
                onClick={handleShareWhatsApp}
                className="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20bd5a] text-white py-3 px-4 rounded-xl font-medium transition-colors"
              >
                <Share2 size={18} />
                Compartilhar via WhatsApp
              </button>
            </div>
          </section>

          <button
            onClick={handleSaveSettings}
            disabled={isSuccess}
            className={`w-full font-medium py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 mb-12 disabled:opacity-50 disabled:cursor-not-allowed ${
              isSuccess ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {isSuccess ? <CheckCircle2 size={20} /> : <Save size={20} />}
            {isSuccess ? 'Salvo com sucesso!' : 'Salvar Configurações'}
          </button>
          
          <div className="border-t border-slate-800 pt-8 pb-12 text-center">
            <div className="inline-flex flex-col items-center">
              <span className="text-slate-400 text-sm font-bold tracking-tight bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
                ExoMind v1.0.5
              </span>
              <span className="text-slate-600 text-[10px] mt-2 uppercase tracking-[0.2em] font-medium">
                Sistema de Memória Externa
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-slate-800 border border-slate-700 rounded-3xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]"
          >
            <div className="p-6 border-b border-slate-700 flex justify-between items-center">
              <h3 className="text-xl font-bold text-white">Exportar Dados</h3>
              <button onClick={() => setShowExportModal(false)} className="text-slate-400 hover:text-white">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* Format Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-3">Formato do Arquivo</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['txt', 'csv', 'json'] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setExportFormat(f)}
                      className={`py-2 px-4 rounded-lg border text-sm font-bold transition-all ${
                        exportFormat === f 
                          ? 'bg-emerald-500 border-emerald-400 text-white' 
                          : 'bg-slate-900 border-slate-700 text-slate-400'
                      }`}
                    >
                      {f.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Item Selection */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="block text-sm font-medium text-slate-400">Selecionar Itens</label>
                  <button 
                    onClick={() => setExportItems(exportItems.length === availableItems.length ? [] : availableItems.map(i => i.id))}
                    className="text-xs text-emerald-400 font-medium"
                  >
                    {exportItems.length === availableItems.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                  </button>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                  {availableItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => toggleItemSelection(item.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                        exportItems.includes(item.id)
                          ? 'bg-emerald-500/10 border-emerald-500/50'
                          : 'bg-slate-900 border-slate-700'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${
                        exportItems.includes(item.id) ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600'
                      }`}>
                        {exportItems.includes(item.id) && <CheckCircle2 size={14} className="text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {item.metadata?.description || item.content.substring(0, 30) || 'Sem título'}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {new Date(item.timestamp).toLocaleDateString()} • {item.type}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-900/50 border-t border-slate-700">
              <button
                onClick={handleExportCustom}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition-colors shadow-lg shadow-emerald-900/20"
              >
                Baixar {exportItems.length || 'Todos os'} Itens
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
