import React from 'react';

interface KcKalvarijaLogoProps {
  className?: string;
  id?: string;
}

export default function KcKalvarijaLogo({ className = "w-14 h-14", id = "kc-kalvarija-logo" }: KcKalvarijaLogoProps) {
  return (
    <img 
      src="/kck-logo-rdec-sekundaren.png" 
      alt="KC Kalvarija Logo" 
      className={`${className} object-contain shrink-0 select-none`} 
      id={id}
    />
  );
}
