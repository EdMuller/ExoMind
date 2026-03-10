import React, { useState, useEffect, useRef } from 'react';
import { Settings as SettingsIcon, Download, Upload, Cloud, Bell, Save, CheckCircle2, AlertCircle, User, Image as ImageIcon, Video, Mic, Volume2, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { GoogleGenAI, Modality } from '@google/genai';
import { getItems, importItems } from '../db';

export function Settings() {
  const [appName, setAppName] = useState('ExoMind');
  const [userName, setUserName] = useState('');
  const [appIcon, setAppIcon] = useState<string | null>(null);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [backupMode, setBackupMode] = useState<'automatic' | 'manual'>('manual');
  const [backupInterval, setBackupInterval] = useState<number>(7);
  const [cloudProvider, setCloudProvider] = useState('');
  const [cloudUrl, setCloudUrl] = useState('');
  const [cloudToken, setCloudToken] = useState('');
  const [selectedVoice, setSelectedVoice] = useState('Zephyr');
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Load settings from localStorage
    setAppName(localStorage.getItem('appName') || 'ExoMind');
    setUserName(localStorage.getItem('userName') || '');
    setAppIcon(localStorage.getItem('appIcon') || null);
    setReminderEnabled(localStorage.getItem('backupReminderEnabled') === 'true');
    setBackupMode((localStorage.getItem('backupMode') as 'automatic' | 'manual') || 'manual');
    setBackupInterval(parseInt(localStorage.getItem('backupInterval') || '7', 10));
    setCloudProvider(localStorage.getItem('cloudProvider') || '');
    setCloudUrl(localStorage.getItem('cloudUrl') || '');
    setCloudToken(localStorage.getItem('cloudToken') || '');
    setSelectedVoice(localStorage.getItem('exo_voice_preference') || 'Zephyr');
  }, []);

  const showStatus = (type: 'success' | 'error', message: string) => {
    setStatus({ type, message });
    setTimeout(() => setStatus({ type: null, message: '' }), 3000);
  };

  const handleSaveSettings = () => {
    localStorage.setItem('appName', appName);
    localStorage.setItem('userName', userName);
    if (appIcon) localStorage.setItem('appIcon', appIcon);
    localStorage.setItem('backupReminderEnabled', reminderEnabled.toString());
    localStorage.setItem('backupMode', backupMode);
    localStorage.setItem('backupInterval', backupInterval.toString());
    localStorage.setItem('cloudProvider', cloudProvider);
    localStorage.setItem('cloudUrl', cloudUrl);
    localStorage.setItem('cloudToken', cloudToken);
    localStorage.setItem('exo_voice_preference', selectedVoice);
    window.dispatchEvent(new Event('settingsUpdated'));
    showStatus('success', 'Configurações salvas com sucesso!');
  };

  const handleExport = async () => {
    try {
      const items = await getItems();
      const dataStr = JSON.stringify(items, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `exomind-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      // Update last backup date
      localStorage.setItem('lastBackupDate', Date.now().toString());
      showStatus('success', 'Backup exportado com sucesso!');
    } catch (error) {
      console.error('Error exporting backup:', error);
      showStatus('error', 'Erro ao exportar backup.');
    }
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
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: "Parabéns, Você está conhecendo seu mais recente e mais completo assistente diário para todos os assuntos." }] }],
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
        
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        let audioBuffer: AudioBuffer;

        try {
          // Try decoding as a standard container (WAV, MP3, etc.)
          audioBuffer = await audioCtx.decodeAudioData(bytes.buffer.slice(0));
        } catch (decodeError) {
          // Fallback: Assume raw 16-bit Linear PCM (24kHz)
          console.warn('Standard decoding failed, attempting raw PCM playback', decodeError);
          const pcmData = new Int16Array(bytes.buffer);
          audioBuffer = audioCtx.createBuffer(1, pcmData.length, 24000);
          const channelData = audioBuffer.getChannelData(0);
          for (let i = 0; i < pcmData.length; i++) {
            channelData[i] = pcmData[i] / 32768.0;
          }
        }

        const source = audioCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioCtx.destination);
        source.start();
        source.onended = () => {
          setIsPreviewing(false);
          audioCtx.close();
        };
      } else {
        setIsPreviewing(false);
      }
    } catch (error) {
      console.error('Error previewing voice:', error);
      setIsPreviewing(false);
      showStatus('error', 'Erro ao reproduzir prévia da voz.');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex-1 flex flex-col h-full absolute inset-0 bg-slate-900 overflow-y-auto p-4"
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
              </select>
              <button
                onClick={handlePreviewVoice}
                disabled={isPreviewing}
                className={`p-3 rounded-lg border transition-colors flex items-center justify-center min-w-[48px] ${
                  isPreviewing 
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' 
                    : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-emerald-500 hover:text-emerald-400'
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
          </section>

          {/* Backup Section */}
          <section className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Save size={20} className="text-blue-400" />
              Backup e Segurança
            </h3>
            
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mb-6">
              <p className="text-blue-200 text-sm leading-relaxed">
                <strong>Importante:</strong> O ExoMind salva seus dados localmente no seu dispositivo para garantir sua privacidade. Por isso, <strong>fazer backups regulares é essencial</strong> para não perder suas informações caso limpe o navegador ou troque de aparelho.
              </p>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-3">Modo de Backup</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className={`flex items-center p-3 border rounded-xl cursor-pointer transition-colors ${backupMode === 'automatic' ? 'bg-blue-500/20 border-blue-500' : 'bg-slate-900 border-slate-700 hover:border-slate-600'}`}>
                    <input type="radio" name="backupMode" value="automatic" checked={backupMode === 'automatic'} onChange={() => setBackupMode('automatic')} className="hidden" />
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center mr-3 ${backupMode === 'automatic' ? 'border-blue-500' : 'border-slate-500'}`}>
                      {backupMode === 'automatic' && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                    </div>
                    <div>
                      <span className="block text-sm font-medium text-white">Automático (Nuvem)</span>
                    </div>
                  </label>
                  <label className={`flex items-center p-3 border rounded-xl cursor-pointer transition-colors ${backupMode === 'manual' ? 'bg-blue-500/20 border-blue-500' : 'bg-slate-900 border-slate-700 hover:border-slate-600'}`}>
                    <input type="radio" name="backupMode" value="manual" checked={backupMode === 'manual'} onChange={() => setBackupMode('manual')} className="hidden" />
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center mr-3 ${backupMode === 'manual' ? 'border-blue-500' : 'border-slate-500'}`}>
                      {backupMode === 'manual' && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                    </div>
                    <div>
                      <span className="block text-sm font-medium text-white">Manual (Local)</span>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  {backupMode === 'automatic' ? 'Frequência do Backup Automático' : 'Lembrar de fazer backup a cada'}
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="1"
                    max="30"
                    value={backupInterval}
                    onChange={(e) => setBackupInterval(parseInt(e.target.value))}
                    className="flex-1 h-2 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                  <span className="bg-slate-900 border border-slate-700 px-3 py-1 rounded-lg text-white font-mono text-sm min-w-[80px] text-center">
                    {backupInterval} {backupInterval === 1 ? 'dia' : 'dias'}
                  </span>
                </div>
                <p className="text-slate-500 text-xs mt-2 italic">
                  {backupMode === 'automatic' 
                    ? 'O sistema tentará enviar seus dados para a nuvem configurada abaixo neste intervalo.' 
                    : 'Você receberá um aviso visual no aplicativo se o último backup for mais antigo que este período.'}
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-700/50">
                <span className="text-sm text-slate-300">Ativar Notificações de Alerta</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer"
                    checked={reminderEnabled}
                    onChange={(e) => setReminderEnabled(e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                </label>
              </div>

              <div className="pt-4 border-t border-slate-700">
                <p className="text-slate-400 text-sm mb-4">Ações Manuais</p>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={handleExport}
                    className="flex flex-col items-center justify-center p-4 bg-slate-900 border border-slate-700 hover:border-blue-500 rounded-xl transition-colors group"
                  >
                    <Download size={24} className="text-slate-400 group-hover:text-blue-400 mb-2 transition-colors" />
                    <span className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors text-center">Exportar Arquivo</span>
                  </button>
                  
                  <input
                    type="file"
                    accept=".json"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleImport}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center p-4 bg-slate-900 border border-slate-700 hover:border-purple-500 rounded-xl transition-colors group"
                  >
                    <Upload size={24} className="text-slate-400 group-hover:text-purple-400 mb-2 transition-colors" />
                    <span className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors text-center">Restaurar Arquivo</span>
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Cloud Config Section */}
          <section className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Cloud size={20} className="text-emerald-400" />
              Armazenamento em Nuvem (Backup e Mídias)
            </h3>
            <p className="text-slate-400 text-sm mb-6">
              Configure os dados do seu provedor de nuvem (ex: Google Drive, AWS S3, Nextcloud). Esta conta única servirá tanto para o <strong>Backup Automático</strong> de segurança quanto para o <strong>Armazenamento de Mídias Pesadas</strong> (como Vídeos, que não cabem no armazenamento local do navegador).
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Provedor / Serviço</label>
                <input
                  type="text"
                  value={cloudProvider}
                  onChange={(e) => setCloudProvider(e.target.value)}
                  placeholder="Ex: Google Drive, Nextcloud, Servidor Próprio"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">URL do Servidor (Opcional)</label>
                <input
                  type="url"
                  value={cloudUrl}
                  onChange={(e) => setCloudUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Token de Acesso / Chave API</label>
                <input
                  type="password"
                  value={cloudToken}
                  onChange={(e) => setCloudToken(e.target.value)}
                  placeholder="••••••••••••••••"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
                />
              </div>
            </div>
          </section>

          <button
            onClick={handleSaveSettings}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 mb-12"
          >
            <Save size={20} />
            Salvar Configurações
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
    </motion.div>
  );
}
