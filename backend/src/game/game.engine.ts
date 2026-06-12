// backend/src/game/game.engine.ts
import { Card, Suit, Player, GameState, PlayAction } from './game.types';

const SUITS: Suit[] = ['SPADES', 'HEARTS', 'DIAMONDS', 'CLUBS'];
const SUIT_CODES: Record<Suit, string> = {
  SPADES: 'S',
  HEARTS: 'H',
  DIAMONDS: 'D',
  CLUBS: 'C'
};

export function createDeck(): Card[] {
  const deck: Card[] = [];
  let id = 0;
  for (const suit of SUITS) {
    for (let value = 2; value <= 14; value++) {
      let code = '';
      if (value <= 10) {
        code = `${value}${SUIT_CODES[suit]}`;
      } else {
        const valMap: Record<number, string> = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
        code = `${valMap[value]}${SUIT_CODES[suit]}`;
      }
      deck.push({ id: id++, suit, value, code });
    }
  }
  return deck;
}

export function shuffleDeck(deck: Card[]): Card[] {
  const newDeck = [...deck];
  for (let i = newDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
  }
  return newDeck;
}

export function dealCards(players: Player[]): void {
  const deck = shuffleDeck(createDeck());
  // Clear any existing cards
  players.forEach(p => {
    p.cards = [];
    p.leftGame = false;
  });

  // Distribute all 52 cards equally
  let cardIdx = 0;
  while (cardIdx < deck.length) {
    for (const player of players) {
      if (cardIdx >= deck.length) break;
      player.cards.push(deck[cardIdx++]);
    }
  }

  // Sort each player's cards for cleaner visual sorting (suit then value)
  players.forEach(p => {
    p.cards.sort((a, b) => {
      if (a.suit !== b.suit) {
        return SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit);
      }
      return a.value - b.value;
    });
  });
}

export function findAceOfSpadesPlayerIndex(players: Player[]): number {
  return players.findIndex(p => p.cards.some(c => c.suit === 'SPADES' && c.value === 14));
}

export function isValidPlay(
  gameState: GameState,
  playerId: string,
  card: Card
): { valid: boolean; reason?: string } {
  const player = gameState.players.find(p => p.id === playerId);
  if (!player) return { valid: false, reason: 'Player not found' };

  // Verify the player has the card
  const hasCard = player.cards.some(c => c.id === card.id);
  if (!hasCard) return { valid: false, reason: 'Card not in player hand' };

  // Check turn order
  const currentPlayer = gameState.players[gameState.currentTurn];
  if (currentPlayer.id !== playerId) {
    return { valid: false, reason: 'Not your turn' };
  }

  const isFirstTrick = gameState.winnerOrder.length === 0 && gameState.trickCards.length === 0;

  // First Trick rule: must lead Ace of Spades if holding it
  if (isFirstTrick) {
    const hasAceOfSpades = player.cards.some(c => c.suit === 'SPADES' && c.value === 14);
    if (hasAceOfSpades && !(card.suit === 'SPADES' && card.value === 14)) {
      return { valid: false, reason: 'You must play the Ace of Spades first' };
    }
  }

  // If there's an active lead suit
  if (gameState.currentSuit) {
    // If player can follow suit, they must
    const hasLeadSuit = player.cards.some(c => c.suit === gameState.currentSuit);
    if (hasLeadSuit && card.suit !== gameState.currentSuit) {
      return { valid: false, reason: `You must follow suit: ${gameState.currentSuit}` };
    }
  }

  return { valid: true };
}

export interface TrickResult {
  nextTurnIndex: number;
  thullaTriggered: boolean;
  thullaReceiverId: string | null;
  cardsPickedUp: Card[];
  trickWinnerId: string | null;
  gameOver: boolean;
}

export function resolvePlay(
  gameState: GameState,
  playerId: string,
  playedCard: Card
): TrickResult {
  // Remove card from player
  const player = gameState.players.find(p => p.id === playerId)!;
  player.cards = player.cards.filter(c => c.id !== playedCard.id);

  // Add card to current trick
  gameState.trickCards.push({ playerId, card: playedCard });

  // If lead suit is not set yet, this card sets it
  if (!gameState.currentSuit) {
    gameState.currentSuit = playedCard.suit;
  }

  const isThulla = playedCard.suit !== gameState.currentSuit;
  const isFirstTrick = gameState.winnerOrder.length === 0 && gameState.trickCards.length === gameState.players.length;

  // Determine if trick is resolved
  let thullaTriggered = false;
  let thullaReceiverId: string | null = null;
  let trickWinnerId: string | null = null;
  let cardsPickedUp: Card[] = [];
  let nextTurnIndex = gameState.currentTurn;

  // Check if player completed their cards
  checkPlayerCompleted(gameState, player);

  if (isThulla) {
    // Thulla triggers: Trick immediately ends
    thullaTriggered = true;
    
    // The player who played the highest card of the original lead suit picks up all cards in the trick
    const leadSuit = gameState.currentSuit!;
    let highestVal = -1;
    let receiverId = '';

    for (const action of gameState.trickCards) {
      if (action.card.suit === leadSuit && action.card.value > highestVal) {
        highestVal = action.card.value;
        receiverId = action.playerId;
      }
    }

    thullaReceiverId = receiverId;
    const receiver = gameState.players.find(p => p.id === receiverId)!;
    
    // Add all cards from trick to receiver's cards
    cardsPickedUp = gameState.trickCards.map(a => a.card);
    receiver.cards.push(...cardsPickedUp);
    
    // Re-sort cards
    receiver.cards.sort((a, b) => {
      if (a.suit !== b.suit) {
        return SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit);
      }
      return a.value - b.value;
    });

    // If receiver had completed their hand but now picked up cards, remove from winner list
    if (receiver.leftGame) {
      receiver.leftGame = false;
      gameState.winnerOrder = gameState.winnerOrder.filter(id => id !== receiverId);
    }

    // Lead suit stays or reset? Trick is ended, the receiver will lead the next trick
    gameState.trickCards = [];
    gameState.currentSuit = null;

    // Find new turn index (receiver starts)
    nextTurnIndex = gameState.players.findIndex(p => p.id === receiverId);
  } else {
    // Normal follow-suit play
    const totalActivePlayers = gameState.players.filter(p => !p.leftGame).length;
    const allPlayed = gameState.trickCards.length === totalActivePlayers;

    if (allPlayed) {
      // Trick complete, everyone followed suit
      // Find highest card of lead suit
      const leadSuit = gameState.currentSuit!;
      let highestVal = -1;
      let winnerId = '';

      for (const action of gameState.trickCards) {
        if (action.card.suit === leadSuit && action.card.value > highestVal) {
          highestVal = action.card.value;
          winnerId = action.playerId;
        }
      }

      trickWinnerId = winnerId;
      gameState.trickCards = [];
      gameState.currentSuit = null;

      // Winner of trick leads next trick
      nextTurnIndex = gameState.players.findIndex(p => p.id === winnerId);
    } else {
      // Trick is not over, determine next turn (only among active players)
      nextTurnIndex = getNextActiveTurnIndex(gameState);
    }
  }

  // Check for game over
  const remainingPlayers = gameState.players.filter(p => !p.leftGame);
  let gameOver = false;
  if (remainingPlayers.length === 1) {
    gameOver = true;
    gameState.status = 'GAME_OVER';
    gameState.loserId = remainingPlayers[0].id;
  }

  gameState.currentTurn = nextTurnIndex;

  return {
    nextTurnIndex,
    thullaTriggered,
    thullaReceiverId,
    cardsPickedUp,
    trickWinnerId,
    gameOver
  };
}

function checkPlayerCompleted(gameState: GameState, player: Player): void {
  if (player.cards.length === 0 && !player.leftGame) {
    player.leftGame = true;
    gameState.winnerOrder.push(player.id);
  }
}

function getNextActiveTurnIndex(gameState: GameState): number {
  let nextIdx = gameState.currentTurn;
  const len = gameState.players.length;
  for (let i = 0; i < len; i++) {
    nextIdx = (nextIdx + 1) % len;
    if (!gameState.players[nextIdx].leftGame) {
      return nextIdx;
    }
  }
  return nextIdx;
}
