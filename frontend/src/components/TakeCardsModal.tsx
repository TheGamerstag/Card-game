'use client';
import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface TakeCardsModalProps {
  requesterName: string;
  targetName: string;
  onAccept: () => void;
  onDecline: () => void;
  onClose: () => void;
  isOpen?: boolean;
}

const TakeCardsModal: React.FC<TakeCardsModalProps> = ({
  requesterName,
  targetName,
  onAccept,
  onDecline,
  onClose,
  isOpen = true,
}) => {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm mx-4 bg-zinc-900 border border-amber-500/30 rounded-2xl p-6 shadow-2xl shadow-black/60"
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-all"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Icon */}
        <div className="text-4xl text-center mb-3">🃏</div>

        {/* Title */}
        <h2 className="text-lg font-extrabold text-white text-center mb-2">
          Card Takeover Request
        </h2>

        {/* Body */}
        <p className="text-sm text-slate-300 text-center mb-6">
          <span className="font-bold text-amber-400">{requesterName}</span> wants to take all of{' '}
          <span className="font-bold text-white">{targetName}</span>&apos;s remaining cards.
          <br />
          <span className="text-xs text-slate-400 mt-1 block">
            If you accept, you finish safely in the next available position.
          </span>
        </p>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onDecline}
            className="flex-1 py-2.5 rounded-xl font-bold text-sm border border-white/10 text-slate-300 hover:bg-white/5 transition-all"
          >
            Decline
          </button>
          <button
            onClick={onAccept}
            className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-lg shadow-emerald-600/25"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
};

export default TakeCardsModal;
