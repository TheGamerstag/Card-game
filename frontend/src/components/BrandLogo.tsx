'use client';

import React from 'react';
import { Spade } from 'lucide-react';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
}

const sizeMap = {
  sm: { title: 'text-xl', icon: 'w-4 h-4', tagline: 'text-[10px]' },
  md: { title: 'text-2xl', icon: 'w-5 h-5', tagline: 'text-xs' },
  lg: { title: 'text-5xl', icon: 'w-8 h-8', tagline: 'text-sm' },
};

export function BrandLogo({ size = 'md', showTagline = false }: BrandLogoProps) {
  const s = sizeMap[size];

  return (
    <div className="flex flex-col items-start">
      <div className="flex items-center gap-2">
        <div className="brand-icon-wrap">
          <Spade className={`${s.icon} text-amber-400 fill-amber-400/20`} />
        </div>
        <h1 className={`${s.title} font-extrabold tracking-tight brand-text`}>
          Bhabii
        </h1>
      </div>
      {showTagline && (
        <p className={`${s.tagline} text-slate-400 mt-1 font-medium tracking-wide`}>
          Classic card showdown, reimagined online
        </p>
      )}
    </div>
  );
}
