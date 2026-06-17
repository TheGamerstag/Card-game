'use client';
import React, { useEffect } from 'react';
import { X, ArrowLeftRight } from 'lucide-react';
import { Card, Suit } from '../types/game';

interface TradeRequestModalProps {
  requesterName: string;
  offeredCardId: number;
  requestedCardId: number;
  // Full card objects if we can look them up (optional)
  offeredCard?: Card;
  requestedCard?: Card;
  onAccept: () => void;
  onDecline: () => void;
  onClose: () => void;
}

const SUIT_SYMBOLS: Record<Suit, string> = {
  SPADES: '♠',
  HEARTS: '♥',
  DIAMONDS: '♦',
  CLUBS: '♣',
};

const SUIT_COLORS: Record<Suit, string> = {
  SPADES: 'text-purple-400',
  HEARTS: 'text-rose-500',
  DIAMONDS: 'text-blue-400',
  CLUBS: 'text-emerald-400',
};

function MiniCard({ card }: { card?: Card }) {
  if (!card) {
    return (
      <div className="w-16 h-24 rounded-lg bg-zinc-800 border border-white/10 flex items-center justify-center text-slate-500 text-xs">
        ?
      </div>
    );
  }
  const displayVal = card.code.slice(0, -1);
  return (
    <div className="w-16 h-24 rounded-lg bg-zinc-100 border border-zinc-300 flex flex-col justify-between p-1.5 select-none">
      <div className="flex flex-col items-start leading-none">
        <span className="text-sm font-bold text-zinc-900">{displayVal}</span>
        <span className={`text-base ${SUIT_COLORS[card.suit]}`}>{SUIT_SYMBOLS[card.suit]}</span>
      </div>
      <div className={`text-2xl self-center ${SUIT_COLORS[card.suit]}`}>{SUIT_SYMBOLS[card.suit]}</div>
    </div>
  );
}

const TradeRequestModal: React.FC<TradeRequestModalProps> = ({
  requesterName,
  offeredCard,
  requestedCard,
  onAccept,
  onDecline,
  onClose,
}) => {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm mx-4 bg-zinc-900 border border-blue-500/30 rounded-2xl p-6 shadow-2xl shadow-black/60"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-all"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="text-4xl text-center mb-3">🔄</div>
        <h2 className="text-lg font-extrabold text-white text-center mb-1">Trade Request</h2>
        <p className="text-xs text-slate-400 text-center mb-5">
          <span className="font-bold text-blue-400">{requesterName}</span> wants to trade cards with you.
        </p>

        {/* Card swap visual */}
        <div className="flex items-center justify-center gap-4 mb-6">
          <div className="flex flex-col items-center gap-1.5">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">They offer</span>
            <MiniCard card={offeredCard} />
          </div>
          <ArrowLeftRight className="w-6 h-6 text-slate-400 flex-shrink-0" />
          <div className="flex flex-col items-center gap-1.5">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">They want</span>
            <MiniCard card={requestedCard} />
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onDecline}
            className="flex-1 py-2.5 rounded-xl font-bold text-sm border border-white/10 text-slate-300 hover:bg-white/5 transition-all"
          >
            Decline
          </button>
          <button
            onClick={onAccept}
            className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-lg shadow-blue-600/25"
          >
            Accept Trade
          </button>
        </div>
      </div>
    </div>
  );
};

export default TradeRequestModal;
