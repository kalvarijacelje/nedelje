import React from 'react';

export interface BrandLogoProps {
  variant?: 'responsive' | 'full' | 'compact';
  subAppTitle?: string;
  href?: string;
  onClick?: () => void;
  className?: string;
  isLight?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  variant = 'responsive',
  subAppTitle,
  href,
  onClick,
  className = '',
}) => {
  const content = (
    <div className={`flex items-center select-none ${className}`}>
      {/* 1. Compact Circular Emblem (Mobile < md) */}
      {variant === 'compact' && (
        <img
          src="/KCK-logo-rdec-sekundaren_small.png"
          alt="KC Kalvarija"
          className="h-8 w-8 object-contain rounded-full shadow-2xs shrink-0"
          loading="eager"
        />
      )}

      {/* 2. Full Horizontal Brand Logotype (Desktop >= md) */}
      {variant === 'full' && (
        <img
          src="/KCK-logo-rdec_small.png"
          alt="Krščanska cerkev Kalvarija Celje"
          className="h-8 md:h-9 w-auto object-contain rounded-xl shadow-2xs shrink-0"
          loading="eager"
        />
      )}

      {/* 3. Responsive Switching: Compact on Mobile (< md), Full on Desktop (>= md) */}
      {variant === 'responsive' && (
        <>
          <img
            src="/KCK-logo-rdec-sekundaren_small.png"
            alt="KC Kalvarija"
            className="md:hidden h-8 w-8 object-contain rounded-full shadow-2xs shrink-0"
            loading="eager"
          />
          <img
            src="/KCK-logo-rdec_small.png"
            alt="Krščanska cerkev Kalvarija Celje"
            className="hidden md:block h-8 md:h-9 w-auto object-contain rounded-xl shadow-2xs shrink-0"
            loading="eager"
          />
        </>
      )}

      {/* Sub-App Divider & Title in clean white */}
      {subAppTitle && (
        <>
          <span className="border-r border-white/25 h-5 mx-3 shrink-0" />
          <span className="font-semibold text-white text-sm tracking-wide uppercase whitespace-nowrap font-['Nohemi',sans-serif]">
            {subAppTitle}
          </span>
        </>
      )}
    </div>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center text-left group focus:outline-none cursor-pointer transition-opacity hover:opacity-90"
        title="Krščanska cerkev Kalvarija Celje"
      >
        {content}
      </button>
    );
  }

  if (href) {
    return (
      <a
        href={href}
        className="inline-flex items-center group focus:outline-none transition-opacity hover:opacity-90"
        title="Krščanska cerkev Kalvarija Celje"
      >
        {content}
      </a>
    );
  }

  return content;
};
