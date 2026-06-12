import { Card, Player, GameState } from './game.types';
export declare function createDeck(): Card[];
export declare function shuffleDeck(deck: Card[]): Card[];
export declare function dealCards(players: Player[]): void;
export declare function findAceOfSpadesPlayerIndex(players: Player[]): number;
export declare function isValidPlay(gameState: GameState, playerId: string, card: Card): {
    valid: boolean;
    reason?: string;
};
export interface TrickResult {
    nextTurnIndex: number;
    thullaTriggered: boolean;
    thullaReceiverId: string | null;
    cardsPickedUp: Card[];
    trickWinnerId: string | null;
    gameOver: boolean;
}
export declare function resolvePlay(gameState: GameState, playerId: string, playedCard: Card): TrickResult;
