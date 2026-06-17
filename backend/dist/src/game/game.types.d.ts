export type Suit = 'SPADES' | 'HEARTS' | 'DIAMONDS' | 'CLUBS';
export interface Card {
    id: number;
    suit: Suit;
    value: number;
    code: string;
}
export interface Player {
    id: string;
    username: string;
    avatar?: string;
    cards: Card[];
    isReady: boolean;
    isReadyForNext?: boolean;
    leftGame: boolean;
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
    currentTurn: number;
    currentSuit: Suit | null;
    trickCards: PlayAction[];
    loserId: string | null;
    winnerOrder: string[];
    isBotRoom?: boolean;
    lastCompletedTrick: PlayAction[] | null;
    pendingTakeRequests?: Record<string, string>;
    pendingTradeRequests?: Record<string, {
        requesterId: string;
        offeredCardId: number;
        requestedCardId: number;
    }>;
    turnStartedAt?: number;
}
