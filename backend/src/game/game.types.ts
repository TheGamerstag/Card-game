// backend/src/game/game.types.ts

export type Suit = 'SPADES' | 'HEARTS' | 'DIAMONDS' | 'CLUBS';

export interface Card {
  id: number;     // 0-51 representation of a standard card deck
  suit: Suit;
  value: number;  // 2 to 14 (Jack=11, Queen=12, King=13, Ace=14)
  code: string;   // e.g. "AS" (Ace of Spades), "10H" (10 of Hearts)
}

export interface Player {
  id: string;        // socket.id or user.id
  username: string;
  avatar?: string;
  cards: Card[];
  isReady: boolean;
  isReadyForNext?: boolean; // ready for next match after game over
  leftGame: boolean; // safe / leaves game after playing all cards
  isBot?: boolean;
  movesCount?: number;
}

export interface PlayAction {
  playerId: string;
  card: Card;
}

export interface GameState {
  roomId: string;
  players: Player[];
  status: 'LOBBY' | 'PLAYING' | 'GAME_OVER';
  deck: Card[];
  currentTurn: number; // index of player whose turn it is
  currentSuit: Suit | null; // lead suit of the current trick
  trickCards: PlayAction[];  // list of cards played in the current trick
  loserId: string | null;    // the player who lost (last remaining player)
  winnerOrder: string[];     // order in which players completed all cards
  isBotRoom?: boolean;
  lastCompletedTrick: PlayAction[] | null;
  // Maps target player ID to requester ID for pending take cards requests
  pendingTakeRequests?: Record<string, string>;
  // Maps target player ID to trade request details
  pendingTradeRequests?: Record<string, { requesterId: string; offeredCardId: number; requestedCardId: number }>;
  turnStartedAt?: number;
}
