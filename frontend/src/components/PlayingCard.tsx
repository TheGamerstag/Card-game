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
  SPADES: 'text-indigo-600 dark:text-indigo-500',
  HEARTS: 'text-rose-600 dark:text-rose-500',
  DIAMONDS: 'text-cyan-600 dark:text-cyan-500',
  CLUBS: 'text-emerald-600 dark:text-emerald-500'
};

const SUIT_GLOWS: Record<Suit, string> = {
  SPADES: 'glow-spades',
  HEARTS: 'glow-hearts',
  DIAMONDS: 'glow-diamonds',
  CLUBS: 'glow-clubs'
};

// Layout coordinates for number card pips (2 to 10)
// Represented as (row, column) in a 5-row by 3-column virtual grid.
// r: 0 to 4 (vertical), c: 0 to 2 (horizontal).
// flip: true indicates the pip should be rotated 180 degrees.
const CARD_LAYOUTS: Record<number, { r: number; c: number; flip?: boolean }[]> = {
  2: [
    { r: 0, c: 1 },
    { r: 4, c: 1, flip: true }
  ],
  3: [
    { r: 0, c: 1 },
    { r: 2, c: 1 },
    { r: 4, c: 1, flip: true }
  ],
  4: [
    { r: 0, c: 0 }, { r: 0, c: 2 },
    { r: 4, c: 0, flip: true }, { r: 4, c: 2, flip: true }
  ],
  5: [
    { r: 0, c: 0 }, { r: 0, c: 2 },
    { r: 2, c: 1 },
    { r: 4, c: 0, flip: true }, { r: 4, c: 2, flip: true }
  ],
  6: [
    { r: 0, c: 0 }, { r: 0, c: 2 },
    { r: 2, c: 0 }, { r: 2, c: 2 },
    { r: 4, c: 0, flip: true }, { r: 4, c: 2, flip: true }
  ],
  7: [
    { r: 0, c: 0 }, { r: 0, c: 2 },
    { r: 1.3, c: 1 },
    { r: 2, c: 0 }, { r: 2, c: 2 },
    { r: 4, c: 0, flip: true }, { r: 4, c: 2, flip: true }
  ],
  8: [
    { r: 0, c: 0 }, { r: 0, c: 2 },
    { r: 1.3, c: 1 },
    { r: 2, c: 0 }, { r: 2, c: 2 },
    { r: 2.7, c: 1, flip: true },
    { r: 4, c: 0, flip: true }, { r: 4, c: 2, flip: true }
  ],
  9: [
    { r: 0, c: 0 }, { r: 0, c: 2 },
    { r: 1.3, c: 0 }, { r: 1.3, c: 2 },
    { r: 2, c: 1 },
    { r: 2.7, c: 0, flip: true }, { r: 2.7, c: 2, flip: true },
    { r: 4, c: 0, flip: true }, { r: 4, c: 2, flip: true }
  ],
  10: [
    { r: 0, c: 0 }, { r: 0, c: 2 },
    { r: 1, c: 1 },
    { r: 1.7, c: 0 }, { r: 1.7, c: 2 },
    { r: 2.3, c: 0, flip: true }, { r: 2.3, c: 2, flip: true },
    { r: 3, c: 1, flip: true },
    { r: 4, c: 0, flip: true }, { r: 4, c: 2, flip: true }
  ]
};

// Symmetrical Court Card Art (singly illustrated & mirrored at 180 degrees)
const CourtCardArt: React.FC<{ value: number; suit: Suit }> = ({ value, suit }) => {
  const suitSymbol = SUIT_SYMBOLS[suit];
  const colorClass = SUIT_COLORS[suit];

  const renderHalf = () => {
    if (value === 11) {
      // Jack: Helmet/Feather, collar, weapon (halberd), chest emblem
      return (
        <g className="text-zinc-700 dark:text-zinc-400">
          {/* Jack Cap / Helmet */}
          <path d="M 32 26 Q 50 14 68 26 Z" fill="currentColor" className="opacity-25" />
          <path d="M 32 26 Q 50 14 68 26" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M 50 14 Q 56 6 64 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /> {/* Feather */}
          
          {/* Face outline */}
          <path d="M 38 26 Q 38 38 50 38 Q 62 38 62 26" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          {/* Eyes & Nose */}
          <circle cx="45" cy="29" r="1.2" fill="currentColor" />
          <circle cx="55" cy="29" r="1.2" fill="currentColor" />
          <path d="M 50 29 L 50 33 L 48 33" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
          
          {/* Collar / Shoulder */}
          <path d="M 28 41 Q 50 33 72 41" stroke="currentColor" strokeWidth="1.5" />
          <path d="M 28 41 Q 50 33 72 41 L 66 50 L 34 50 Z" fill="currentColor" className="opacity-15" />
          
          {/* Halberd Staff */}
          <path d="M 20 50 L 20 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M 16 20 L 20 11 L 24 20 Z" fill="currentColor" />
          
          {/* Suit Emblem on Chest */}
          <text x="50" y="47" textAnchor="middle" className={`text-[9px] font-extrabold fill-current ${colorClass}`}>
            {suitSymbol}
          </text>
        </g>
      );
    } else if (value === 12) {
      // Queen: Tiara, flowing hair, holding a flower, chest emblem
      return (
        <g className="text-zinc-700 dark:text-zinc-400">
          {/* Tiara */}
          <path d="M 36 24 L 43 14 L 50 19 L 57 14 L 64 24 Z" fill="currentColor" className="opacity-30" />
          <path d="M 36 24 L 43 14 L 50 19 L 57 14 L 64 24" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          
          {/* Face outline */}
          <path d="M 38 24 Q 38 37 50 37 Q 62 37 62 24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          {/* Hair loops */}
          <path d="M 36 24 Q 28 32 32 44 M 64 24 Q 72 32 68 44" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
          
          {/* Eyes & Smile */}
          <circle cx="45" cy="28" r="1.2" fill="currentColor" />
          <circle cx="55" cy="28" r="1.2" fill="currentColor" />
          <path d="M 46 32 Q 50 35 54 32" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none" />

          {/* Robe Collar */}
          <path d="M 30 44 Q 50 37 70 44" stroke="currentColor" strokeWidth="1.5" />
          <path d="M 32 44 L 50 50 L 68 44 Z" fill="currentColor" className="opacity-20" />
          
          {/* Flower */}
          <path d="M 22 44 Q 24 37 24 48" stroke="currentColor" strokeWidth="1" />
          <circle cx="21" cy="40" r="2.5" fill="currentColor" />
          
          {/* Suit Emblem on Chest */}
          <text x="50" y="47" textAnchor="middle" className={`text-[9px] font-extrabold fill-current ${colorClass}`}>
            {suitSymbol}
          </text>
        </g>
      );
    } else {
      // King: Symmetrical crown, beard, scepter, chest emblem
      return (
        <g className="text-zinc-700 dark:text-zinc-400">
          {/* Crown */}
          <path d="M 34 23 L 40 10 L 50 17 L 60 10 L 66 23 Z" fill="currentColor" className="opacity-30" />
          <path d="M 34 23 L 40 10 L 50 17 L 60 10 L 66 23" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <circle cx="50" cy="8" r="1.5" fill="currentColor" />
          
          {/* Face & beard */}
          <path d="M 38 23 L 38 33 Q 50 42 62 33 L 62 23 Z" fill="currentColor" className="opacity-15" />
          <path d="M 38 23 L 38 33 Q 50 42 62 33 L 62 23" stroke="currentColor" strokeWidth="1.5" />
          {/* Beard detail lines */}
          <path d="M 42 33 L 45 37 M 58 33 L 55 37 M 50 34 L 50 39" stroke="currentColor" strokeWidth="1" />

          {/* Eyes & Mustache */}
          <circle cx="45" cy="27" r="1.2" fill="currentColor" />
          <circle cx="55" cy="27" r="1.2" fill="currentColor" />
          <path d="M 44 30 Q 50 32 56 30" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />

          {/* Scepter */}
          <path d="M 21 46 L 21 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="21" cy="19" r="3.2" fill="currentColor" />
          <path d="M 18 19 L 24 19" stroke="currentColor" strokeWidth="1" />
          
          {/* Suit Emblem on Chest */}
          <text x="50" y="47" textAnchor="middle" className={`text-[9px] font-extrabold fill-current ${colorClass}`}>
            {suitSymbol}
          </text>
        </g>
      );
    }
  };

  return (
    <svg className="w-full h-full pointer-events-none" viewBox="0 0 100 100" fill="none">
      {/* Symmetrical divider line */}
      <line x1="8" y1="50" x2="92" y2="50" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 3" className="opacity-20 text-zinc-400 dark:text-zinc-600" />
      
      {/* Top half */}
      <g>
        {renderHalf()}
      </g>
      
      {/* Bottom half, rotated 180 degrees around (50,50) */}
      <g transform="rotate(180 50 50)">
        {renderHalf()}
      </g>
    </svg>
  );
};

export const PlayingCard: React.FC<PlayingCardProps> = ({
  card,
  onClick,
  disabled = false,
  isPlayable = true
}) => {
  const displayVal = card.code.slice(0, -1);
  const pips = CARD_LAYOUTS[card.value] || [];

  return (
    <motion.div
      whileHover={!disabled && isPlayable ? { y: -36, scale: 1.15, rotate: 1 } : {}}
      whileTap={!disabled && isPlayable ? { scale: 0.95 } : {}}
      onClick={() => {
        if (!disabled && onClick) onClick();
      }}
      className={`relative w-24 h-36 rounded-xl border flex flex-col justify-between p-2 select-none cursor-pointer transition-all duration-300
        ${isPlayable ? 'bg-gradient-to-br from-white to-zinc-100 border-zinc-200 text-zinc-900 shadow-md' : 'bg-zinc-200 border-zinc-300 opacity-60 pointer-events-none text-zinc-500'}
        ${!disabled && isPlayable ? 'hover:shadow-2xl hover:shadow-black/40' : ''}
        ${!disabled && isPlayable ? SUIT_GLOWS[card.suit] : ''}
      `}
      layout
    >
      {/* Premium thin inner border */}
      <div className="absolute inset-1 border border-zinc-200/50 rounded-lg pointer-events-none" />

      {/* Top Left corner value */}
      <div className="flex flex-col items-start leading-none z-10">
        <span className="text-sm font-extrabold">{displayVal}</span>
        <span className={`text-sm ${SUIT_COLORS[card.suit]}`}>{SUIT_SYMBOLS[card.suit]}</span>
      </div>

      {/* Center Art Area */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        
        {/* Case 1: Ace Centerpiece (value 14) */}
        {card.value === 14 && (
          <div className="relative flex items-center justify-center w-12 h-12 rounded-full bg-zinc-50/80 border border-zinc-200/40 shadow-inner">
            {/* Elegant double-ring ornament */}
            <div className="absolute inset-0.5 border border-dashed border-zinc-300/60 rounded-full" />
            <span className={`text-4xl ${SUIT_COLORS[card.suit]}`}>{SUIT_SYMBOLS[card.suit]}</span>
          </div>
        )}

        {/* Case 2: Court Cards (value 11-13) */}
        {card.value >= 11 && card.value <= 13 && (
          <div className="absolute inset-x-4 inset-y-6 border border-zinc-200/40 rounded bg-zinc-50/40 overflow-hidden">
            <CourtCardArt value={card.value} suit={card.suit} />
          </div>
        )}

        {/* Case 3: Number Cards (value 2-10) with exact pips */}
        {card.value >= 2 && card.value <= 10 && (
          <div className="absolute inset-x-5 inset-y-6">
            {pips.map((pip, index) => {
              const left = `${pip.c * 37.5 + 12.5}%`;
              const top = `${pip.r * 18.75 + 12.5}%`;
              return (
                <span
                  key={index}
                  className={`absolute text-xs leading-none transition-colors duration-300 ${SUIT_COLORS[card.suit]}`}
                  style={{
                    left,
                    top,
                    transform: `translate(-50%, -50%) ${pip.flip ? 'rotate(180deg)' : ''}`,
                  }}
                >
                  {SUIT_SYMBOLS[card.suit]}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom Right corner value (rotated 180 degrees) */}
      <div className="flex flex-col items-end leading-none self-end rotate-180 z-10">
        <span className="text-sm font-extrabold">{displayVal}</span>
        <span className={`text-sm ${SUIT_COLORS[card.suit]}`}>{SUIT_SYMBOLS[card.suit]}</span>
      </div>
    </motion.div>
  );
};
