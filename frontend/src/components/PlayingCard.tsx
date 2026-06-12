// frontend/src/components/PlayingCard.tsx
'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Card, Suit } from '../types/game';

interface PlayingCardProps {
  card: Card;
  onClick?: () => void;
  disabled?: boolean;
  isPlayable?: boolean;
}

const SUIT_SYMBOLS: Record<Suit, string> = {
  SPADES: '♠',
  HEARTS: '♥',
  DIAMONDS: '♦',
  CLUBS: '♣'
};

const SUIT_COLORS: Record<Suit, string> = {
  SPADES: 'text-purple-400',
  HEARTS: 'text-rose-500',
  DIAMONDS: 'text-blue-400',
  CLUBS: 'text-emerald-400'
};

const SUIT_GLOWS: Record<Suit, string> = {
  SPADES: 'glow-spades',
  HEARTS: 'glow-hearts',
  DIAMONDS: 'glow-diamonds',
  CLUBS: 'glow-clubs'
};

export const PlayingCard: React.FC<PlayingCardProps> = ({
  card,
  onClick,
  disabled = false,
  isPlayable = true
}) => {
  const isRed = card.suit === 'HEARTS' || card.suit === 'DIAMONDS';
  const displayVal = card.code.slice(0, -1);

  return (
    <motion.div
      whileHover={!disabled && isPlayable ? { y: -24, scale: 1.05, rotate: 1 } : {}}
      whileTap={!disabled && isPlayable ? { scale: 0.95 } : {}}
      onClick={() => {
        if (!disabled && onClick) onClick();
      }}
      className={`relative w-24 h-36 rounded-xl border flex flex-col justify-between p-3 select-none cursor-pointer transition-all duration-300
        ${isPlayable ? 'bg-gradient-to-br from-zinc-100 to-zinc-200 border-zinc-300 text-zinc-900' : 'bg-zinc-300 border-zinc-400 opacity-60 pointer-events-none text-zinc-700'}
        ${!disabled && isPlayable ? 'hover:shadow-2xl hover:shadow-black/40' : ''}
        ${!disabled && isPlayable ? SUIT_GLOWS[card.suit] : ''}
      `}
      layout
    >
      {/* Top Left corner value */}
      <div className="flex flex-col items-start leading-none">
        <span className="text-lg font-bold">{displayVal}</span>
        <span className={`text-xl ${SUIT_COLORS[card.suit]}`}>{SUIT_SYMBOLS[card.suit]}</span>
      </div>

      {/* Center symbol */}
      <div className={`text-4xl self-center ${SUIT_COLORS[card.suit]}`}>
        {SUIT_SYMBOLS[card.suit]}
      </div>

      {/* Bottom Right corner value */}
      <div className="flex flex-col items-end leading-none self-end rotate-180">
        <span className="text-lg font-bold">{displayVal}</span>
        <span className={`text-xl ${SUIT_COLORS[card.suit]}`}>{SUIT_SYMBOLS[card.suit]}</span>
      </div>
    </motion.div>
  );
};
