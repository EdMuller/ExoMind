import React from 'react';
import { loginWithGoogle } from '../firebase';
import { LogIn, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

const Login: React.FC = () => {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-zinc-900 border border-zinc-800 p-10 rounded-3xl max-w-md w-full text-center space-y-8 shadow-2xl"
      >
        <div className="flex justify-center">
          <div className="p-4 bg-indigo-500/10 rounded-2xl border border-indigo-500/20">
            <Sparkles className="w-12 h-12 text-indigo-400" />
          </div>
        </div>
        
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-zinc-100 tracking-tight">Assistente Holístico</h1>
          <p className="text-zinc-400">Entre para acessar seu painel pessoal e assistente de IA.</p>
        </div>

        <button
          onClick={loginWithGoogle}
          className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white hover:bg-zinc-100 text-zinc-950 font-semibold rounded-2xl transition-all shadow-lg active:scale-[0.98]"
        >
          <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
          Entrar com Google
        </button>

        <div className="pt-4 text-xs text-zinc-500">
          Ao entrar, você concorda com nossos termos de uso e política de privacidade.
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
