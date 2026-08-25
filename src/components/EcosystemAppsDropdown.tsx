import React, { useState, useEffect, useRef } from 'react';

export type EcosystemAppKey = 'main' | 'vodnik' | 'nedelje' | 'ucenja' | 'kruh' | 'zivavera';

export interface AppDefinition {
  key: EcosystemAppKey;
  name: string;
  subtitle: string;
  icon: string;
  badge?: string;
  isStandalone?: boolean;
  prodUrl: string;
  devPort: number;
}

export const CORE_APPS: AppDefinition[] = [
  {
    key: 'main',
    name: 'Kalvarija Celje',
    subtitle: 'Uradni portal cerkve',
    icon: '⛪',
    prodUrl: 'https://kalvarija.si',
    devPort: 3000,
  },
  {
    key: 'nedelje',
    name: 'Organizacija Nedelj',
    subtitle: 'Razporedi, službe in šola',
    icon: '📅',
    prodUrl: 'https://nedelje.kalvarija.si',
    devPort: 3001,
  },
  {
    key: 'ucenja',
    name: 'Arhiv Učenj',
    subtitle: 'Pridige, zvočni & video posnetki',
    icon: '📖',
    prodUrl: 'https://ucenja.kalvarija.si',
    devPort: 3002,
  },
  {
    key: 'kruh',
    name: 'Kruh Življenja',
    subtitle: 'Prehranska pomoč & logistika',
    icon: '🍞',
    prodUrl: 'https://kruhzivljenja.kalvarija.si',
    devPort: 5173,
  },
];

export const STANDALONE_APPS: AppDefinition[] = [
  {
    key: 'vodnik',
    name: 'Osebni Vodnik',
    subtitle: 'Učeništvo, mentorstvo & navade',
    icon: '🧭',
    badge: 'Učeništvo',
    isStandalone: true,
    prodUrl: 'https://osebnivodnik.kalvarija.si',
    devPort: 3003,
  },
  {
    key: 'zivavera',
    name: 'Kavarna Živa Vera',
    subtitle: 'Kavarna & skupnostni prostor',
    icon: '☕',
    badge: 'Kavarna',
    isStandalone: true,
    prodUrl: 'https://zivavera.kalvarija.si',
    devPort: 8080,
  },
];

export const ECOSYSTEM_APPS: AppDefinition[] = [...CORE_APPS, ...STANDALONE_APPS];

interface EcosystemAppsDropdownProps {
  currentApp?: EcosystemAppKey;
  isLight?: boolean;
  onOpenModal?: () => void;
  className?: string;
}

export const EcosystemAppsDropdown: React.FC<EcosystemAppsDropdownProps> = ({
  currentApp = 'nedelje',
  isLight = false,
  onOpenModal,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const resolveAppLink = (app: AppDefinition) => {
    if (typeof window === 'undefined') return app.prodUrl;
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocalhost) {
      return `http://localhost:${app.devPort}`;
    }
    return app.prodUrl;
  };

  const renderAppItem = (app: AppDefinition) => {
    const isCurrent = app.key === currentApp;
    return (
      <a
        key={app.key}
        href={resolveAppLink(app)}
        onClick={() => setIsOpen(false)}
        className={`group flex items-start gap-3 p-2.5 rounded-xl transition-all ${
          isCurrent
            ? 'bg-[#FAF7F2] border border-[#93032E]/20 text-[#93032E]'
            : 'hover:bg-slate-50 text-slate-800'
        }`}
      >
        <span className="text-2xl shrink-0 p-1 bg-white rounded-lg border border-slate-100 shadow-2xs group-hover:scale-105 transition-transform">
          {app.icon}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1.5">
            <span className="font-heading font-bold text-sm truncate">
              {app.name}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              {isCurrent ? (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#93032E] text-white">
                  Trenutna
                </span>
              ) : app.badge ? (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-stone-100 text-stone-600 border border-stone-200/60">
                  {app.badge}
                </span>
              ) : null}
            </div>
          </div>
          <p className="text-xs text-slate-500 truncate mt-0.5">{app.subtitle}</p>
        </div>
      </a>
    );
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer select-none ${
          isLight
            ? isOpen
              ? 'bg-white/25 text-white'
              : 'text-white/90 hover:text-white hover:bg-white/15'
            : isOpen
            ? 'bg-[#93032E] text-white shadow-xs'
            : 'bg-white hover:bg-slate-50 text-[#93032E] border border-[#93032E]/30 shadow-2xs'
        }`}
        title="Preklopi med aplikacijami Kalvarija"
      >
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="5" cy="5" r="2.2" />
          <circle cx="12" cy="5" r="2.2" />
          <circle cx="19" cy="5" r="2.2" />
          <circle cx="5" cy="12" r="2.2" />
          <circle cx="12" cy="12" r="2.2" />
          <circle cx="19" cy="12" r="2.2" />
          <circle cx="5" cy="19" r="2.2" />
          <circle cx="12" cy="19" r="2.2" />
          <circle cx="19" cy="19" r="2.2" />
        </svg>
        <span className="hidden sm:inline font-heading">Aplikacije</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-white rounded-2xl shadow-2xl border border-[#A6A15E]/20 p-2 z-50 text-slate-800 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
            <p className="text-[11px] font-black text-[#A6A15E] tracking-wider uppercase font-heading">
              Ekosistem Kalvarija Celje
            </p>
          </div>

          {/* Section 1: Core Church Apps */}
          <div className="px-2.5 pt-2 pb-1 text-[10px] font-black text-slate-400 uppercase tracking-wider font-heading">
            Cerkvene Aplikacije
          </div>
          <div className="grid gap-1">
            {CORE_APPS.map(renderAppItem)}
          </div>

          {/* Section Divider */}
          <div className="my-2 border-t border-slate-100" />

          {/* Section 2: Standalone Apps & Projects */}
          <div className="px-2.5 pt-0.5 pb-1 flex items-center justify-between text-[10px] font-black text-slate-400 uppercase tracking-wider font-heading">
            <span>Samostojni Projekti</span>
            <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200/80">
              Samostojno
            </span>
          </div>
          <div className="grid gap-1">
            {STANDALONE_APPS.map(renderAppItem)}
          </div>

          {onOpenModal && (
            <div className="pt-2 mt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenModal();
                }}
                className="w-full py-1.5 text-center text-xs font-bold text-[#93032E] hover:underline cursor-pointer font-heading"
              >
                Več informacij o orodjih &rarr;
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
