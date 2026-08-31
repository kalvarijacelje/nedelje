import React, { useState, useEffect } from 'react';
import { BrandLogo } from './BrandLogo';
import { EcosystemAppsDropdown, EcosystemAppKey } from './EcosystemAppsDropdown';
import {
  Youtube,
  Facebook,
  Instagram,
  LogOut,
  Download,
  Smartphone,
  X,
  LogIn,
  CheckCircle2,
  ShieldCheck,
  ChevronDown,
  Mail,
  Lock,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { supabase, performGlobalSignOut } from '../supabaseClient';

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
  testRole?: string | null;
  onTestRoleChange?: (role: any) => void;
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
  testRole,
  onTestRoleChange,
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
  const [isSendingMagicLink, setIsSendingMagicLink] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  useEffect(() => {
    setSelectedLang(currentLang);
  }, [currentLang]);

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
    }
  };

  const handleToggleLang = (lang: 'sl' | 'en') => {
    setSelectedLang(lang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('church_roster_lang_v2', lang);
      localStorage.setItem('kck_lang', lang);
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
            queryParams: {
              prompt: 'select_account',
            },
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

  const handleMagicLinkSignIn = async () => {
    if (!email || !email.includes('@')) {
      setAuthError(selectedLang === 'sl' ? 'Vnesite veljaven e-poštni naslov.' : 'Please enter a valid email address.');
      return;
    }
    setIsSendingMagicLink(true);
    setAuthError(null);
    setMagicLinkSent(false);

    try {
      if (supabase) {
        const { error } = await supabase.auth.signInWithOtp({
          email: email.trim(),
          options: {
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        setMagicLinkSent(true);
      }
    } catch (err: any) {
      console.warn('Magic link error:', err);
      setAuthError(err?.message || (selectedLang === 'sl' ? 'Pošiljanje povezave ni uspelo.' : 'Failed to send login link.'));
    } finally {
      setIsSendingMagicLink(false);
    }
  };

  return (
    <header className={`sticky top-0 z-50 transition-all ${className}`}>
      {/* Tier 1: Top Crimson Banner (Identical to localhost:3000 / kalvarija.si) */}
      <div className="bg-[#93032E] text-white text-xs py-1.5 px-4 sm:px-6 shadow-sm border-b border-black/10 select-none">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          {/* Left: App Pill Badge & Description */}
          <div className="flex-1 min-w-0 flex items-center gap-2 truncate">
            <span className="flex items-center justify-center px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-[10px] shrink-0 tracking-wider uppercase shadow-2xs">
              {meta.title}
            </span>
            <span className="font-bold truncate text-xs sm:text-[13px] tracking-tight text-white/90">
              {displaySubtitle}
            </span>
          </div>

          {/* Right: Socials, Install, Language, User */}
          <div className="flex items-center gap-2.5 sm:gap-4 shrink-0">
            {/* Social Icons & PWA Install */}
            <div className="flex items-center gap-1 sm:gap-1.5 border-r border-white/20 pr-2 sm:pr-3">
              <a href="https://www.youtube.com/@KCKalvarija" target="_blank" rel="noopener noreferrer" className="w-6 h-6 rounded-md bg-white/10 hover:bg-white/25 text-white/90 hover:text-white flex items-center justify-center transition-all cursor-pointer" title="YouTube" aria-label="YouTube">
                <Youtube className="w-3.5 h-3.5 text-rose-300 hover:text-white" />
              </a>
              <a href="https://www.facebook.com/kck.celje" target="_blank" rel="noopener noreferrer" className="w-6 h-6 rounded-md bg-white/10 hover:bg-white/25 text-white/90 hover:text-white flex items-center justify-center transition-all cursor-pointer" title="Facebook" aria-label="Facebook">
                <Facebook className="w-3.5 h-3.5 text-blue-200 hover:text-white" />
              </a>
              <a href="https://www.instagram.com/kalvarijacelje/" target="_blank" rel="noopener noreferrer" className="w-6 h-6 rounded-md bg-white/10 hover:bg-white/25 text-white/90 hover:text-white flex items-center justify-center transition-all cursor-pointer" title="Instagram" aria-label="Instagram">
                <Instagram className="w-3.5 h-3.5 text-pink-200 hover:text-white" />
              </a>
              {!isPwaInstalled && (
                <div className="relative group ml-0.5">
                  <button onClick={handlePwaInstall} className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-[11px] transition-all cursor-pointer shadow-xs border border-amber-300/80 hover:scale-105" title="Install App">
                    <Download className="w-3.5 h-3.5 text-slate-950 animate-bounce" />
                    <span className="hidden sm:inline">{selectedLang === 'sl' ? 'Namesti APP' : 'Install App'}</span>
                  </button>
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-1.5 bg-slate-950/95 backdrop-blur-md text-white text-[11px] font-semibold rounded-xl shadow-2xl border border-white/20 whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-all duration-200 z-50">
                    <div className="flex items-center gap-1.5">
                      <Smartphone className="w-3.5 h-3.5 text-amber-400" />
                      <span>{selectedLang === 'sl' ? `Namesti na telefon / PC` : `Install to Home Screen`}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Language Switcher */}
            <div className="flex items-center bg-black/25 rounded-lg p-0.5 border border-white/20">
              <button
                onClick={() => handleToggleLang('sl')}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${selectedLang === 'sl' ? 'bg-white text-[#93032E] shadow-sm font-black' : 'text-white/80 hover:text-white'}`}
                title="Slovenski jezik"
              >SL</button>
              <button
                onClick={() => handleToggleLang('en')}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${selectedLang === 'en' ? 'bg-white text-[#93032E] shadow-sm font-black' : 'text-white/80 hover:text-white'}`}
                title="English language"
              >EN</button>
            </div>
            
            {/* User Profile / Login Badge with Full Name */}
            {user ? (() => {
              const formatSlovenianDisplayName = (rawName?: string | null, email?: string | null): string => {
                const emailLower = (email || '').toLowerCase().trim();
                let name = (rawName || '').trim();
                if (
                  emailLower.includes('ales.lajlar') ||
                  emailLower.includes('aleslajlar') ||
                  (name.toLowerCase() === 'ales' || name.toLowerCase() === 'ales lajlar')
                ) {
                  return 'Aleš Lajlar';
                }
                if (!name && email) name = email.split('@')[0];
                if (!name) return 'Uporabnik';

                // If name is dot-separated like "kenzley.lajlar", format to capitalized words "Kenzley Lajlar"
                if (name.includes('.') && !name.includes(' ')) {
                  name = name.split('.').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
                }

                return name
                  .replace(/\bAles\b/g, 'Aleš')
                  .replace(/\bales\b/g, 'Aleš')
                  .replace(/\bStefan\b/g, 'Štefan')
                  .replace(/\bStef\b/g, 'Štef')
                  .replace(/\bSpela\b/g, 'Špela')
                  .replace(/\bBostjan\b/g, 'Boštjan')
                  .replace(/\bBozena\b/g, 'Božena')
                  .replace(/\bZiga\b/g, 'Žiga')
                  .replace(/\bZan\b/g, 'Žan')
                  .replace(/\bCrt\b/g, 'Črt')
                  .replace(/\bMatjaz\b/g, 'Matjaž')
                  .replace(/\bMarusa\b/g, 'Maruša')
                  .replace(/\bAljosa\b/g, 'Aljoša')
                  .replace(/\bAnze\b/g, 'Anže')
                  .replace(/\bSasa\b/g, 'Saša')
                  .replace(/\bBlaz\b/g, 'Blaž');
              };
              const userDisplayName = formatSlovenianDisplayName(user.name, user.email);
              const initial = (userDisplayName[0] || 'A').toUpperCase();

              return (
                <div className="relative">
                  <button
                    onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                    className="flex items-center gap-1.5 pl-1.5 pr-2.5 py-0.5 rounded-lg bg-white/15 hover:bg-white/25 text-white transition cursor-pointer border border-white/20 text-xs font-bold"
                    title={userDisplayName}
                  >
                    <div className="w-5 h-5 rounded-full bg-white text-[#93032E] font-black flex items-center justify-center text-[10px] shrink-0">
                      {initial}
                    </div>
                    <span className="hidden sm:inline max-w-[160px] truncate">{userDisplayName}</span>
                  </button>

                  {userDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 z-50 text-slate-800 animate-in fade-in slide-in-from-top-2 duration-150">
                      <div className="p-2.5 border-b border-slate-100">
                        <div className="font-bold text-xs text-slate-900 truncate">{userDisplayName}</div>
                        <div className="text-[11px] text-slate-500 truncate">{user.email}</div>
                        {user.role && (
                          <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                            {user.role}
                          </span>
                        )}
                      </div>

                      {onTestRoleChange && (user.email === 'ales.lajlar@gmail.com' || user.role === 'Superadmin' || user.role === 'Admin') && (
                        <div className="p-2 border-b border-slate-100 bg-slate-50/70">
                          <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1.5 flex items-center justify-between">
                            <span>🛠️ {selectedLang === 'sl' ? 'Skrbniška simulacija' : 'Admin Simulation'}</span>
                            {testRole && (
                              <span className="text-[9px] text-[#93032E] font-bold">({testRole})</span>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-1">
                            {(['Admin', 'Leader', 'Servant', 'Viewer'] as const).map(r => {
                              const isSelected = (testRole || user.role) === r;
                              return (
                                <button
                                  key={r}
                                  type="button"
                                  onClick={() => onTestRoleChange(testRole === r ? null : r)}
                                  className={`px-1.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer text-center ${
                                    isSelected
                                      ? 'bg-[#93032E] text-white shadow-2xs'
                                      : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-200'
                                  }`}
                                >
                                  {r} {testRole === r ? '★' : ''}
                                </button>
                              );
                            })}
                          </div>
                          {testRole && (
                            <button
                              type="button"
                              onClick={() => onTestRoleChange(null)}
                              className="w-full text-center text-[10px] text-slate-500 hover:text-slate-800 underline mt-1.5 cursor-pointer"
                            >
                              {selectedLang === 'sl' ? 'Ponastavi na vlogo računa' : 'Reset to account role'}
                            </button>
                          )}
                        </div>
                      )}
                      <button
                        onClick={() => {
                          setUserDropdownOpen(false);
                          if (onLogout) onLogout();
                          else performGlobalSignOut();
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 mt-1 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer text-left"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>{selectedLang === 'sl' ? 'Odjava' : 'Sign Out'}</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })() : (
              <button
                onClick={() => {
                  if (onLogin) onLogin();
                  else setIsAuthModalOpen(true);
                }}
                className="flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-white text-[#93032E] hover:bg-white/90 font-bold text-xs transition-all cursor-pointer shadow-xs"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>{selectedLang === 'sl' ? 'Prijava' : 'Sign In'}</span>
              </button>
            )}

          </div>
        </div>
      </div>

      {/* Tier 2: Main Pure White Navbar (Identical to localhost:3000 / kalvarija.si) */}
      <nav className="bg-white/95 backdrop-blur-md py-3 sm:py-3.5 border-b border-[#A6A15E]/20 shadow-2xs">
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between gap-2 xl:gap-4 px-4 sm:px-6 lg:px-8">
          
          {/* Left: Clean Brand Logo matching main portal */}
          <BrandLogo
            variant="responsive"
            isLight={false}
            className="shrink-0 cursor-pointer"
          />

          {/* Center: Desktop Navigation Tabs */}
          {extraNavItems && (
            <div className="hidden lg:flex items-center gap-1 xl:gap-1.5 shrink-0">
              {extraNavItems}
            </div>
          )}

          {/* Right: Right Action Items + Standardized 9-Dot Ecosystem Apps Dropdown */}
          <div className="flex items-center gap-1.5 xl:gap-2 shrink-0">
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
                <span>{selectedLang === 'sl' ? 'Uporabniški račun KCK' : 'KCK Member Portal'}</span>
              </div>
              <h3 className="text-xl font-black font-heading">
                {selectedLang === 'sl' ? 'Prijava v cerkveni portal' : 'Sign in to Church Portal'}
              </h3>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {authError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{authError}</span>
                </div>
              )}

              {/* 1. Fast Google Sign-In */}
              <button
                onClick={handleGoogleSignIn}
                disabled={isSigningInGoogle}
                className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-bold text-sm shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                {isSigningInGoogle ? (
                  <Loader2 className="w-4 h-4 animate-spin text-[#93032E]" />
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                )}
                <span>{selectedLang === 'sl' ? 'Nadaljuj z Google računom' : 'Continue with Google'}</span>
              </button>

              {/* 2. Email Password Dropdown */}
              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEmailForm(!showEmailForm)}
                  className="w-full flex items-center justify-between py-2 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  <span>{selectedLang === 'sl' ? 'Prijava z e-pošto in geslom' : 'Sign in with Email & Password'}</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${showEmailForm ? 'rotate-180 text-[#93032E]' : ''}`} />
                </button>

                {showEmailForm && (
                  <form onSubmit={handleEmailSignIn} className="space-y-3 pt-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                        {selectedLang === 'sl' ? 'E-poštni naslov' : 'Email Address'}
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="vasa.eposta@gmail.com"
                          className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#93032E] focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                        {selectedLang === 'sl' ? 'Geslo' : 'Password'}
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="password"
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#93032E] focus:outline-none"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isEmailSubmitting}
                      className="w-full py-2.5 rounded-xl bg-[#93032E] hover:bg-[#7a0225] text-white font-bold text-xs shadow-sm transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isEmailSubmitting ? (
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                      ) : (
                        <LogIn className="w-4 h-4" />
                      )}
                      <span>{selectedLang === 'sl' ? 'Prijavi se' : 'Sign In'}</span>
                    </button>

                    <div className="pt-1 text-center">
                      <button
                        type="button"
                        onClick={handleMagicLinkSignIn}
                        disabled={isSendingMagicLink || !email}
                        className="text-[11px] text-slate-500 hover:text-[#93032E] underline cursor-pointer disabled:opacity-50 disabled:no-underline transition-colors"
                      >
                        {isSendingMagicLink
                          ? (selectedLang === 'sl' ? 'Pošiljanje povezave...' : 'Sending link...')
                          : (selectedLang === 'sl' ? 'Nimate gesla? Pošlji povezavo na e-pošto' : "Don't have a password? Send link to email")}
                      </button>
                      {magicLinkSent && (
                        <p className="text-[11px] text-emerald-600 font-medium mt-1 animate-in fade-in">
                          {selectedLang === 'sl' ? '✓ Povezava za prijavo poslana na vaš e-poštni naslov!' : '✓ Login link sent to your email address!'}
                        </p>
                      )}
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
