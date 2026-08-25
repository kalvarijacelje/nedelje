import React, { useState, useEffect } from 'react';
import { Download, X, Calendar, Sparkles } from 'lucide-react';
import { Language } from '../types';

interface PwaInstallBannerProps {
  currentLang: Language;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const PwaInstallBanner: React.FC<PwaInstallBannerProps> = ({ currentLang }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // If running in standalone mode (already installed), don't show
    if (typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches) {
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      if (!sessionStorage.getItem('kck_nedelje_pwa_dismissed')) {
        setIsVisible(true);
      }
    };

    const installedHandler = () => {
      setIsVisible(false);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', installedHandler);

    // Show popup after brief delay if not dismissed and not standalone
    const timer = setTimeout(() => {
      if (
        !sessionStorage.getItem('kck_nedelje_pwa_dismissed') &&
        !(window.matchMedia('(display-mode: standalone)').matches)
      ) {
        setIsVisible(true);
      }
    }, 3500);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
      clearTimeout(timer);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsVisible(false);
      }
      setDeferredPrompt(null);
    } else {
      // Fallback instruction for iOS Safari and other browsers
      alert(
        currentLang === 'sl'
          ? 'Za namestitev aplikacije KCK Nedelje na telefon izberite »Dodaj na začetni zaslon« v meniju brskalnika.'
          : 'To install KCK Sundays on your home screen, tap "Add to Home Screen" in your browser menu.'
      );
      setIsVisible(false);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    setIsDismissed(true);
    sessionStorage.setItem('kck_nedelje_pwa_dismissed', 'true');
  };

  if (!isVisible || isDismissed) return null;

  return (
    <div className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-50 max-w-sm w-full bg-[#032B22] text-white p-4 rounded-2xl shadow-2xl border border-emerald-600/40 animate-in slide-in-from-bottom-6 duration-300">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#034C3C] text-white flex items-center justify-center font-black text-sm border border-emerald-400/30 shadow-xs">
            <Calendar className="w-4 h-4 text-emerald-200" />
          </div>
          <div>
            <div className="text-xs font-black tracking-wide text-white flex items-center gap-1.5">
              <span>{currentLang === 'sl' ? 'Namestite KCK Nedelje' : 'Install KCK Sundays App'}</span>
              <Sparkles className="w-3 h-3 text-emerald-300" />
            </div>
            <div className="text-[10px] text-emerald-200/90">
              {currentLang === 'sl'
                ? 'Urnik služenja, menjave & obvestila'
                : 'Service schedule, shift swaps & updates'}
            </div>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="text-emerald-300 hover:text-white transition-colors cursor-pointer p-1"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center gap-2 pt-2">
        <button
          onClick={handleInstallClick}
          className="flex-1 py-2 px-3 rounded-xl bg-[#047857] hover:bg-[#036045] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-all border border-emerald-400/20"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{currentLang === 'sl' ? 'Namesti na telefon / PC' : 'Add to Home Screen'}</span>
        </button>
        <button
          onClick={handleDismiss}
          className="py-2 px-3 rounded-xl bg-emerald-950 hover:bg-emerald-900 text-emerald-300 text-xs font-medium transition-colors cursor-pointer"
        >
          {currentLang === 'sl' ? 'Kasneje' : 'Later'}
        </button>
      </div>
    </div>
  );
};
