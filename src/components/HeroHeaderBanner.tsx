/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { LucideIcon } from 'lucide-react';

export type HeroBannerVariant = 'home' | 'schedule' | 'school' | 'worship' | 'ministries' | 'people';

interface HeroHeaderBannerProps {
  variant: HeroBannerVariant;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}

const VARIANT_STYLES: Record<HeroBannerVariant, { containerStyle: React.CSSProperties; eyebrowBg: string; eyebrowText: string }> = {
  home: {
    containerStyle: {
      background: 'linear-gradient(135deg, #034C3C 0%, #022F25 50%, #0079BB 100%)',
    },
    eyebrowBg: 'bg-[#A6A15E]/20 border-[#A6A15E]/40',
    eyebrowText: 'text-[#EBDDD6]',
  },
  schedule: {
    containerStyle: {
      background: 'linear-gradient(135deg, #0079BB 0%, #023847 60%, #034C3C 100%)',
    },
    eyebrowBg: 'bg-[#0079BB]/30 border-[#0079BB]/50',
    eyebrowText: 'text-[#EBDDD6]',
  },
  school: {
    containerStyle: {
      background: 'linear-gradient(135deg, #93032E 0%, #7A0225 45%, #E2474F 100%)',
    },
    eyebrowBg: 'bg-[#EDBF29]/25 border-[#EDBF29]/40',
    eyebrowText: 'text-[#EDBF29]',
  },
  worship: {
    containerStyle: {
      background: 'linear-gradient(135deg, #4338CA 0%, #2E1065 50%, #93032E 100%)',
    },
    eyebrowBg: 'bg-[#818CF8]/25 border-[#818CF8]/40',
    eyebrowText: 'text-[#EBDDD6]',
  },
  ministries: {
    containerStyle: {
      background: 'linear-gradient(135deg, #034C3C 0%, #02382D 50%, #29B7A9 100%)',
    },
    eyebrowBg: 'bg-[#29B7A9]/20 border-[#29B7A9]/40',
    eyebrowText: 'text-[#EBDDD6]',
  },
  people: {
    containerStyle: {
      background: 'linear-gradient(135deg, #0079BB 0%, #15324D 55%, #93032E 100%)',
    },
    eyebrowBg: 'bg-[#0079BB]/30 border-[#0079BB]/50',
    eyebrowText: 'text-[#EBDDD6]',
  },
};

export default function HeroHeaderBanner({
  variant,
  eyebrow,
  title,
  subtitle,
  icon: Icon,
  actions,
  children,
}: HeroHeaderBannerProps) {
  const styles = VARIANT_STYLES[variant];

  return (
    <div
      style={styles.containerStyle}
      className="relative rounded-3xl p-5 sm:p-7 text-white shadow-xl overflow-hidden border border-white/10 transition-all duration-300"
    >
      {/* Large Background Watermark Icon */}
      {Icon && (
        <Icon className="w-56 h-56 sm:w-72 sm:h-72 opacity-[0.08] pointer-events-none absolute -right-6 -bottom-10 text-white transform -rotate-12 select-none" />
      )}

      {/* Glassmorphism ambient sheen */}
      <div className="absolute -inset-x-20 -top-20 h-40 bg-white/5 blur-2xl pointer-events-none transform -rotate-6" />

      {/* Main Content Layout */}
      <div className="relative z-10 space-y-4">
        {/* Top Eyebrow & Actions Bar */}
        {(eyebrow || actions) && (
          <div className="flex items-center justify-between gap-3 flex-wrap">
            {eyebrow ? (
              <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] sm:text-xs font-mono font-bold uppercase tracking-wider border backdrop-blur-md ${styles.eyebrowBg} ${styles.eyebrowText}`}>
                <span>{eyebrow}</span>
              </div>
            ) : <div />}
            {actions && (
              <div className="flex flex-wrap items-center gap-2">
                {actions}
              </div>
            )}
          </div>
        )}

        {/* Title & Subtitle */}
        <div className="space-y-1.5 max-w-3xl">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-display font-extrabold tracking-tight text-white leading-tight drop-shadow-xs">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs sm:text-sm text-[#EBDDD6]/90 font-sans leading-relaxed max-w-2xl">
              {subtitle}
            </p>
          )}
        </div>

        {/* Optional Children Slot (Widgets / Extra Stats) */}
        {children && <div className="pt-2">{children}</div>}
      </div>
    </div>
  );
}
