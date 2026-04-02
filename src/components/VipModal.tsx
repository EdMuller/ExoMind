import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, X, Star, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../AuthContext';

interface VipModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function VipModal({ isOpen, onClose }: VipModalProps) {
  const { unlockVip } = useAuth();
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  if (!isOpen) return null;

  const handleUnlock = async () => {
    if (!code.trim()) return;
    setStatus('loading');
    try {
      const success = await unlockVip(code);
      if (success) {
        setStatus('success');
        setTimeout(() => {
          onClose();
        }, 2500);
      } else {
        setStatus('error');
      }
    } catch (error) {
      setStatus('error');
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="bg-slate-800 border border-slate-700 rounded-3xl p-6 w-full max-w-md shadow-2xl relative overflow-hidden"
        >
          {/* Decorative background elements */}
          <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-amber-500/20 to-transparent pointer-events-none" />
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-white bg-slate-900/50 rounded-full p-2 transition-colors z-10"
          >
            <X size={20} />
          </button>

          <div className="relative z-10 flex flex-col items-center text-center mt-4">
            <div className="w-20 h-20 bg-amber-500/20 rounded-full flex items-center justify-center mb-6 border border-amber-500/30">
              <Gift size={40} className="text-amber-400" />
            </div>
            
            <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
              <Star className="text-amber-400" size={24} fill="currentColor" />
              Parabéns !
              <Star className="text-amber-400" size={24} fill="currentColor" />
            </h2>
            
            <p className="text-slate-300 mb-2">
              Você foi convidado a acessar recursos exclusivos do ExoMind !
            </p>
            <p className="text-slate-300 mb-8">
              Insira abaixo, seu código de acesso para desbloquear:
            </p>

            {status === 'success' ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-emerald-500/20 border border-emerald-500/30 rounded-2xl p-6 w-full flex flex-col items-center"
              >
                <CheckCircle2 size={48} className="text-emerald-400 mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">Acesso Liberado!</h3>
                <p className="text-emerald-200 text-sm">
                  Parabéns! Você agora tem acesso às <strong className="text-white">Vozes de IA Ilimitadas</strong> e outros recursos exclusivos que estão por vir.
                </p>
              </motion.div>
            ) : (
              <div className="w-full space-y-4">
                <div className="relative">
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value.toUpperCase());
                      if (status === 'error') setStatus('idle');
                    }}
                    placeholder="DIGITE O CÓDIGO"
                    className={`w-full bg-slate-900 border ${status === 'error' ? 'border-red-500 focus:ring-red-500' : 'border-slate-700 focus:ring-amber-500'} rounded-xl p-4 text-center text-xl font-bold text-white tracking-widest focus:ring-2 focus:border-transparent outline-none transition-all`}
                    maxLength={10}
                  />
                  {status === 'error' && (
                    <div className="absolute -bottom-6 left-0 right-0 flex justify-center items-center gap-1 text-red-400 text-xs font-medium">
                      <AlertCircle size={12} />
                      Código inválido
                    </div>
                  )}
                </div>

                <button
                  onClick={handleUnlock}
                  disabled={!code.trim() || status === 'loading'}
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-bold py-4 px-6 rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                >
                  {status === 'loading' ? (
                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Sparkles size={20} />
                      Desbloquear VIP
                    </>
                  )}
                </button>
              </div>
            )}

            <div className="mt-8 text-left w-full bg-slate-900/50 rounded-xl p-4 border border-slate-700/50">
              <h4 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wider">O que inclui o VIP?</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-amber-400" />
                  <span className="text-white">Vozes de IA Ilimitadas</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-amber-400" />
                  <span className="text-white">Análise de Fotos por IA</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-amber-400" />
                  <span className="text-white">Suporte Prioritário VIP</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-slate-500" />
                  <span>Relatórios Diários (Em breve)</span>
                </li>
              </ul>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
