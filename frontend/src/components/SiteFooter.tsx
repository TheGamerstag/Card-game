'use client';

import React from 'react';
import { Heart } from 'lucide-react';

export function SiteFooter() {
  return (
    <footer className="site-footer mt-auto border-t border-white/5 bg-black/20 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
        <p className="flex items-center gap-1.5">
          <span>© {new Date().getFullYear()} Bhabii</span>
          <span className="hidden sm:inline text-slate-700">·</span>
          <span className="hidden sm:inline">Play fair. Play smart.</span>
        </p>
        <p className="flex items-center gap-1.5 font-semibold text-slate-400">
          Made with <Heart className="w-3 h-3 text-rose-500 fill-rose-500/30" /> by{' '}
          <span className="gamers-tag text-amber-400/90">GamersTag</span>
        </p>
      </div>
    </footer>
  );
}
