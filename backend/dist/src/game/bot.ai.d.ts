import { Card, GameState } from './game.types';
export declare function getValidPlays(gameState: GameState, playerId: string): Card[];
export declare function pickBotCard(gameState: GameState, playerId: string): Card | null;
export declare const BOT_NAMES: string[];
export declare function isBotPlayer(playerId: string): boolean;
