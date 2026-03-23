import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cake, X, PartyPopper, Heart } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAuth } from '../AuthContext';

export function BirthdaySurprise() {
  const { isVip } = useAuth();
  const [isVisible, setIsVisible] = useState(false);

  const triggerConfetti = useCallback(() => {
    const duration = 5 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
    }, 250);
  }, []);

  const checkBirthday = useCallback(() => {
    const now = new Date();
    const isMarch24 = now.getMonth() === 2 && now.getDate() === 24; // March is 2 (0-indexed)
    
    const alreadyShown = sessionStorage.getItem('birthdayShown');
    const justUnlocked = sessionStorage.getItem('justUnlockedVip');

    // Trigger if it's the birthday AND user is VIP
    // OR if they JUST entered the code (for testing)
    if ((isMarch24 && isVip && !alreadyShown) || (justUnlocked && !alreadyShown)) {
      setIsVisible(true);
      triggerConfetti();
      
      // If it was just unlocked for testing, we don't want to block the real one tomorrow
      // but we mark it as shown for this session
      if (justUnlocked) {
        sessionStorage.removeItem('justUnlockedVip');
      }
    }
  }, [isVip, triggerConfetti]);

  useEffect(() => {
    checkBirthday();
    
    // Listen for the unlock event to trigger immediately
    window.addEventListener('vipUnlocked', checkBirthday);
    return () => window.removeEventListener('vipUnlocked', checkBirthday);
  }, [checkBirthday]);

  const handleClose = () => {
    setIsVisible(false);
    sessionStorage.setItem('birthdayShown', 'true');
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
          <motion.div
            initial={{ scale: 0.5, opacity: 0, y: 100 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.5, opacity: 0, y: 100 }}
            className="bg-gradient-to-br from-purple-600 to-blue-600 p-8 rounded-[2.5rem] shadow-2xl max-w-sm w-full text-center relative overflow-hidden border border-white/20"
          >
            {/* Decorative elements */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
              <div className="absolute top-[-10%] left-[-10%] w-40 h-40 bg-white rounded-full blur-3xl" />
              <div className="absolute bottom-[-10%] right-[-10%] w-40 h-40 bg-pink-500 rounded-full blur-3xl" />
            </div>

            <button 
              onClick={handleClose}
              className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>

            <div className="relative z-10">
              <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-6 backdrop-blur-sm border border-white/30">
                <Cake size={40} className="text-white" />
              </div>

              <h2 className="text-3xl font-black text-white mb-2 tracking-tight">
                Parabéns, Cacá! 🥳
              </h2>
              
              <div className="flex items-center justify-center gap-2 mb-6 text-blue-100 font-medium">
                <PartyPopper size={18} />
                <span>Hoje o dia é todo seu!</span>
                <PartyPopper size={18} />
              </div>

              <p className="text-white/90 leading-relaxed mb-8">
                Este aplicativo foi criado com muito carinho para ser o seu novo segundo cérebro. Que ele te ajude a conquistar tudo o que você planejar!
              </p>

              <button
                onClick={handleClose}
                className="w-full bg-white text-blue-600 font-bold py-4 rounded-2xl shadow-xl hover:bg-blue-50 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <Heart size={20} className="fill-current" />
                Obrigado!
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
