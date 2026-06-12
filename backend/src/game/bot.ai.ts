import { Card, GameState } from './game.types';
import { isValidPlay } from './game.engine';

export function getValidPlays(gameState: GameState, playerId: string): Card[] {
  const player = gameState.players.find(p => p.id === playerId);
  if (!player) return [];

  return player.cards.filter(card => isValidPlay(gameState, playerId, card).valid);
}

export function pickBotCard(gameState: GameState, playerId: string): Card | null {
  const validPlays = getValidPlays(gameState, playerId);
  if (validPlays.length === 0) return null;
  if (validPlays.length === 1) return validPlays[0];

  const leadSuit = gameState.currentSuit;
  const followingSuit = leadSuit && validPlays.some(c => c.suit === leadSuit);

  if (followingSuit) {
    const suitCards = validPlays.filter(c => c.suit === leadSuit);
    return suitCards.reduce((lowest, card) => (card.value < lowest.value ? card : lowest));
  }

  if (leadSuit) {
    const dumpCards = validPlays.filter(c => c.suit !== leadSuit);
    if (dumpCards.length > 0) {
      return dumpCards.reduce((lowest, card) => (card.value < lowest.value ? card : lowest));
    }
  }

  return validPlays.reduce((lowest, card) => (card.value < lowest.value ? card : lowest));
}

export const BOT_NAMES = ['CPU Ace', 'CPU King', 'CPU Queen', 'CPU Jack', 'CPU Dealer'];

export function isBotPlayer(playerId: string): boolean {
  return playerId.startsWith('bot-');
}
