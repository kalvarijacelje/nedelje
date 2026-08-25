import React, { useState, useEffect } from 'react';
import { BrandLogo } from './BrandLogo';
import { EcosystemAppsDropdown, EcosystemAppKey } from './EcosystemAppsDropdown';
import {
  Youtube,
  Facebook,
  Instagram,
  Radio,
  LogOut,
  Download,
  Smartphone,
  X,
  LogIn,
  CheckCircle2,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Mail,
  Lock,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { supabase } from '../supabaseClient';

export interface EcosystemUser {
  id?: string;
  name: string;
  email: string;
  role?: string;
  avatarUrl?: string;
}

export interface EcosystemNavbarProps {
  currentApp: EcosystemAppKey;
  subAppSubtitle?: string;
  user?: EcosystemUser | null;
  onLogin?: () => void;
  onLogout?: () => void;
  currentLang?: 'sl' | 'en';
  onLanguageChange?: (lang: 'sl' | 'en') => void;
  extraNavItems?: React.ReactNode;
  rightActionItems?: React.ReactNode;
  className?: string;
}

const SUB_APP_METAS: Record<EcosystemAppKey, { title: string; subtitle: string }> = {
  main: { title: 'CERKEV', subtitle: 'Uradni portal cerkve' },
  nedelje: { title: 'NEDELJE', subtitle: 'Organizacija nedeljskih bogoslužij KCK' },
  ucenja: { title: 'UČENJA', subtitle: 'Arhiv svetopisemskih naukov in pridig' },
  kruh: { title: 'KRUH ŽIVLJENJA', subtitle: 'Prehranska pomoč & logistika' },
  vodnik: { title: 'OSEBNI VODNIK', subtitle: 'Učeništvo, mentorstvo in navade' },
  zivavera: { title: 'ŽIVA VERA', subtitle: 'Kavarna & skupnostni prostor' },
};

export const EcosystemNavbar: React.FC<EcosystemNavbarProps> = ({
  currentApp = 'nedelje',
  subAppSubtitle,
  user,
  onLogin,
  onLogout,
  currentLang = 'sl',
  onLanguageChange,
  extraNavItems,
  rightActionItems,
  className = '',
}) => {
  const [selectedLang, setSelectedLang] = useState<'sl' | 'en'>(currentLang);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isPwaInstalled, setIsPwaInstalled] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isSigningInGoogle, setIsSigningInGoogle] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isEmailSubmitting, setIsEmailSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      localStorage.getItem(`kck_${currentApp}_pwa_installed`) === 'true' ||
      localStorage.getItem('kck_pwa_installed') === 'true'
    ) {
      setIsPwaInstalled(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const installedHandler = () => {
      setIsPwaInstalled(true);
      if (typeof window !== 'undefined') {
        localStorage.setItem(`kck_${currentApp}_pwa_installed`, 'true');
      }
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, [currentApp]);

  const handlePwaInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsPwaInstalled(true);
        if (typeof window !== 'undefined') {
          localStorage.setItem(`kck_${currentApp}_pwa_installed`, 'true');
        }
      }
      setDeferredPrompt(null);
    } else {
      alert(
        selectedLang === 'sl'
          ? 'Za namestitev aplikacije na telefon izberite »Dodaj na začetni zaslon« v meniju brskalnika.'
          : 'To install this app on your device, tap "Add to Home Screen" in your browser menu.'
      );
    }
  };

  const handleToggleLang = (lang: 'sl' | 'en') => {
    setSelectedLang(lang);
    if (typeof document !== 'undefined') {
      const isKalvarija = window.location.hostname.includes('kalvarija.si');
      const domain = isKalvarija ? '; domain=.kalvarija.si' : '';
      document.cookie = `kck_lang=${lang}; path=/${domain}; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    }
    if (onLanguageChange) onLanguageChange(lang);
  };

  const meta = SUB_APP_METAS[currentApp] || SUB_APP_METAS.nedelje;
  const displaySubtitle = subAppSubtitle || meta.subtitle;

  const handleGoogleSignIn = async () => {
    setIsSigningInGoogle(true);
    setAuthError(null);
    try {
      if (supabase) {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: window.location.origin,
          },
        });
        if (error) throw error;
      }
    } catch (err: any) {
      console.warn('Google sign in error:', err);
      setAuthError(err?.message || (selectedLang === 'sl' ? 'Prijava z Google računom ni uspela.' : 'Google sign-in failed.'));
      setIsSigningInGoogle(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setIsEmailSubmitting(true);
    setAuthError(null);

    try {
      if (supabase) {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password,
        });

        if (error) throw error;

        setIsEmailSubmitting(false);
        setIsAuthModalOpen(false);
        window.location.reload();
        return;
      }
      setIsEmailSubmitting(false);
      setIsAuthModalOpen(false);
    } catch (err: any) {
      console.warn('Email sign in error:', err);
      setAuthError(err?.message || (selectedLang === 'sl' ? 'Napačen e-poštni naslov ali geslo.' : 'Invalid email or password.'));
      setIsEmailSubmitting(false);
    }
  };

  return (
    <header className={`sticky top-0 z-50 transition-all ${className}`}>
      <div className="bg-[#93032E] text-white text-xs px-4 sm:px-6 lg:px-8 h-9 sm:h-10 flex items-center justify-between border-b border-black/10">
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 truncate">
            <span className="flex items-center justify-center px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-[10px] shrink-0 tracking-wider">
              {meta.title}
            </span>
            <span className="font-bold truncate text-xs sm:text-[13px] tracking-tight text-white/90">
              {displaySubtitle}
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="flex items-center gap-1 sm:gap-1.5 border-r border-white/20 pr-2 sm:pr-3">
              <a href="https://www.youtube.com/@KCKalvarija" target="_blank" rel="noopener noreferrer" className="w-6 h-6 rounded-md bg-white/10 hover:bg-white/25 text-white/90 hover:text-white flex items-center justify-center transition-all cursor-pointer" title="YouTube" aria-label="YouTube">
                <Youtube className="w-3.5 h-3.5 text-rose-300" />
              </a>
              <a href="https://www.facebook.com/kck.celje" target="_blank" rel="noopener noreferrer" className="w-6 h-6 rounded-md bg-white/10 hover:bg-white/25 text-white/90 hover:text-white flex items-center justify-center transition-all cursor-pointer" title="Facebook" aria-label="Facebook">
                <Facebook className="w-3.5 h-3.5 text-blue-200" />
              </a>
              <a href="https://www.instagram.com/kalvarijacelje/" target="_blank" rel="noopener noreferrer" className="w-6 h-6 rounded-md bg-white/10 hover:bg-white/25 text-white/90 hover:text-white flex items-center justify-center transition-all cursor-pointer" title="Instagram" aria-label="Instagram">
                <Instagram className="w-3.5 h-3.5 text-pink-200" />
              </a>
              {!isPwaInstalled && (
                <button onClick={handlePwaInstall} className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-[11px] transition-all cursor-pointer" title="Install App">
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{selectedLang === 'sl' ? 'Namesti APP' : 'Install'}</span>
                </button>
              )}
            </div>

            <div className="flex items-center bg-black/25 rounded-lg p-0.5 border border-white/20">
              <button
                onClick={() => handleToggleLang('sl')}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${selectedLang === 'sl' ? 'bg-white text-[#93032E] shadow-sm' : 'text-white/80 hover:text-white'}`}
                title="Slovenski jezik"
              >SL</button>
              <button
                onClick={() => handleToggleLang('en')}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${selectedLang === 'en' ? 'bg-white text-[#93032E] shadow-sm' : 'text-white/80 hover:text-white'}`}
                title="English language"
              >EN</button>
            </div>
            
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="flex items-center gap-1.5 pl-1.5 pr-2 py-0.5 rounded-lg bg-white/15 hover:bg-white/25 text-white transition cursor-pointer border border-white/20 text-xs font-bold"
                  title={user.name}
                >
                  <div className="w-5 h-5 rounded-full bg-white text-[#93032E] font-black flex items-center justify-center text-[10px]">
                    {user.name ? user.name[0] : 'U'}
                  </div>
                  <span className="hidden sm:inline max-w-[80px] truncate">{user.name.split(' ')[0]}</span>
                </button>

                {userDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-[#A6A15E]/20 p-2 z-50 text-slate-800 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="p-2.5 border-b border-gray-100">
                      <div className="font-bold text-xs text-slate-900 truncate">{user.name}</div>
                      <div className="text-[11px] text-slate-500 truncate">{user.email}</div>
                      {user.role && (
                        <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#034C3C]/10 text-[#034C3C]">
                          {user.role}
                        </span>
                      )}
                    </div>
                    {onLogout && (
                      <button
                        onClick={() => {
                          setUserDropdownOpen(false);
                          onLogout();
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 mt-1 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer text-left"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Odjava</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => {
                  if (onLogin) onLogin();
                  else setIsAuthModalOpen(true);
                }}
                className="px-2.5 py-0.5 bg-white text-[#93032E] hover:bg-white/90 rounded-lg text-xs font-bold transition cursor-pointer shadow-xs"
              >
                Prijava
              </button>
            )}

          </div>
        </div>
      </div>

      {/* Tier 2: Main Pure White Navbar (matches kalvarija.si) */}
      <nav className="bg-white/95 backdrop-blur-md border-b border-[#A6A15E]/20 shadow-xs h-16 px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between gap-2 xl:gap-4">
          
          {/* Left: Responsive Brand Logo with Sub-App Name in Bold Wine Red */}
          <BrandLogo
            variant="responsive"
            isLight={false}
            subAppTitle={currentApp !== 'main' ? meta.title : undefined}
          />

          {/* Center: Desktop Navigation Tabs */}
          {extraNavItems && (
            <div className="hidden lg:flex items-center gap-1 xl:gap-1.5 shrink-0">
              {extraNavItems}
            </div>
          )}

          {/* Right: 9-Dot Ecosystem Apps Dropdown + App Action Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {rightActionItems}
            <EcosystemAppsDropdown currentApp={currentApp} isLight={false} />
          </div>

        </div>
      </nav>

      {/* Unified Auth Modal */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200 relative animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-6 bg-gradient-to-r from-[#93032E] to-[#7a0225] text-white relative">
              <button
                onClick={() => setIsAuthModalOpen(false)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Zapri"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2 mb-1 text-xs uppercase tracking-wider font-bold text-[#EBDDD6]">
                <ShieldCheck className="w-4 h-4" />
                <span>{selectedLang === 'sl' ? 'KCK Uporabniški račun' : 'KCK Member Portal'}</span>
              </div>
              <h3 className="text-xl font-black font-heading">
                {selectedLang === 'sl' ? 'Prijava v Nedelje' : 'Sign in to Nedelje'}
              </h3>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed text-center">
                {selectedLang === 'sl'
                  ? 'Za pregled vaših dodeljenih služb, menjavo terminov ter vnos odsotnosti se prijavite s svojim računom.'
                  : 'Sign in to view your upcoming service duties, request shift swaps, and set blackout dates.'}
              </p>

              {authError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <span>{authError}</span>
                </div>
              )}

              {/* 1. PRIMARY BASE OPTION: 1-Click Google / Gmail Sign In */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isSigningInGoogle}
                className="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-2xl border-2 border-slate-300 bg-white hover:bg-slate-50 hover:border-slate-400 text-slate-900 font-bold text-sm shadow-sm transition-all cursor-pointer group active:scale-[0.98]"
              >
                {isSigningInGoogle ? (
                  <Loader2 className="w-5 h-5 animate-spin text-[#93032E]" />
                ) : (
                  <svg className="w-5 h-5 shrink-0 group-hover:scale-105 transition-transform" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                )}
                <span>
                  {isSigningInGoogle
                    ? selectedLang === 'sl' ? 'Povezovanje z Google...' : 'Connecting with Google...'
                    : selectedLang === 'sl' ? 'Nadaljuj z Google računom (Gmail)' : 'Continue with Google (Gmail)'}
                </span>
              </button>

              {/* 2. SECONDARY OPTION: Collapsible Dropdown for Email Sign In */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowEmailForm(!showEmailForm)}
                  className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 py-1.5 transition-colors cursor-pointer"
                >
                  <span>
                    {selectedLang === 'sl'
                      ? 'Ali pa se prijavi z e-pošto in geslom'
                      : 'Or sign in with email and password'}
                  </span>
                  {showEmailForm ? (
                    <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  )}
                </button>

                {showEmailForm && (
                  <form onSubmit={handleEmailSignIn} className="mt-3 p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                        {selectedLang === 'sl' ? 'E-poštni naslov' : 'Email Address'}
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="ime@domena.si"
                          className="w-full pl-9 pr-3 py-2 bg-white rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#93032E]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                        {selectedLang === 'sl' ? 'Geslo' : 'Password'}
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="password"
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full pl-9 pr-3 py-2 bg-white rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#93032E]"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isEmailSubmitting}
                      className="w-full py-2.5 px-4 rounded-xl bg-[#93032E] hover:bg-[#7a0225] text-white text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isEmailSubmitting ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <LogIn className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {isEmailSubmitting
                          ? selectedLang === 'sl' ? 'Preverjanje...' : 'Verifying...'
                          : selectedLang === 'sl' ? 'Prijava z e-pošto' : 'Sign In with Email'}
                      </span>
                    </button>
                  </form>
                )}
              </div>

              <div className="pt-2 text-[11px] text-slate-400 text-center">
                {selectedLang === 'sl'
                  ? 'Varno overjanje • Povezano s cerkveno bazo'
                  : 'Secure authentication • Connected to church database'}
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
