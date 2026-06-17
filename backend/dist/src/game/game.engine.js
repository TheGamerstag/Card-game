"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDeck = createDeck;
exports.shuffleDeck = shuffleDeck;
exports.dealCards = dealCards;
exports.findAceOfSpadesPlayerIndex = findAceOfSpadesPlayerIndex;
exports.isValidPlay = isValidPlay;
exports.resolvePlay = resolvePlay;
const SUITS = ['SPADES', 'HEARTS', 'DIAMONDS', 'CLUBS'];
const SUIT_CODES = {
    SPADES: 'S',
    HEARTS: 'H',
    DIAMONDS: 'D',
    CLUBS: 'C'
};
function createDeck() {
    const deck = [];
    let id = 0;
    for (const suit of SUITS) {
        for (let value = 2; value <= 14; value++) {
            let code = '';
            if (value <= 10) {
                code = `${value}${SUIT_CODES[suit]}`;
            }
            else {
                const valMap = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
                code = `${valMap[value]}${SUIT_CODES[suit]}`;
            }
            deck.push({ id: id++, suit, value, code });
        }
    }
    return deck;
}
function shuffleDeck(deck) {
    const newDeck = [...deck];
    for (let i = newDeck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
    }
    return newDeck;
}
function dealCards(players) {
    const deck = shuffleDeck(createDeck());
    players.forEach(p => {
        p.cards = [];
        p.leftGame = false;
    });
    let cardIdx = 0;
    while (cardIdx < deck.length) {
        for (const player of players) {
            if (cardIdx >= deck.length)
                break;
            player.cards.push(deck[cardIdx++]);
        }
    }
    players.forEach(p => {
        p.cards.sort((a, b) => {
            if (a.suit !== b.suit) {
                return SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit);
            }
            return a.value - b.value;
        });
    });
}
function findAceOfSpadesPlayerIndex(players) {
    return players.findIndex(p => p.cards.some(c => c.suit === 'SPADES' && c.value === 14));
}
function isValidPlay(gameState, playerId, card) {
    const player = gameState.players.find(p => p.id === playerId);
    if (!player)
        return { valid: false, reason: 'Player not found' };
    const hasCard = player.cards.some(c => c.id === card.id);
    if (!hasCard)
        return { valid: false, reason: 'Card not in player hand' };
    const currentPlayer = gameState.players[gameState.currentTurn];
    if (currentPlayer.id !== playerId) {
        return { valid: false, reason: 'Not your turn' };
    }
    const isFirstTrick = gameState.winnerOrder.length === 0 && gameState.trickCards.length === 0;
    if (isFirstTrick) {
        const hasAceOfSpades = player.cards.some(c => c.suit === 'SPADES' && c.value === 14);
        if (hasAceOfSpades && !(card.suit === 'SPADES' && card.value === 14)) {
            return { valid: false, reason: 'You must play the Ace of Spades first' };
        }
    }
    if (gameState.currentSuit) {
        const hasLeadSuit = player.cards.some(c => c.suit === gameState.currentSuit);
        if (hasLeadSuit && card.suit !== gameState.currentSuit) {
            return { valid: false, reason: `You must follow suit: ${gameState.currentSuit}` };
        }
    }
    return { valid: true };
}
function resolvePlay(gameState, playerId, playedCard) {
    const player = gameState.players.find(p => p.id === playerId);
    player.cards = player.cards.filter(c => c.id !== playedCard.id);
    gameState.trickCards.push({ playerId, card: playedCard });
    if (!gameState.currentSuit) {
        gameState.currentSuit = playedCard.suit;
    }
    const isThulla = playedCard.suit !== gameState.currentSuit;
    const isFirstTrick = gameState.winnerOrder.length === 0 && gameState.trickCards.length === gameState.players.length;
    let thullaTriggered = false;
    let thullaReceiverId = null;
    let trickWinnerId = null;
    let cardsPickedUp = [];
    let nextTurnIndex = gameState.currentTurn;
    checkPlayerCompleted(gameState, player);
    if (isThulla) {
        thullaTriggered = true;
        const leadSuit = gameState.currentSuit;
        let highestVal = -1;
        let receiverId = '';
        for (const action of gameState.trickCards) {
            if (action.card.suit === leadSuit && action.card.value > highestVal) {
                highestVal = action.card.value;
                receiverId = action.playerId;
            }
        }
        thullaReceiverId = receiverId;
        const receiver = gameState.players.find(p => p.id === receiverId);
        cardsPickedUp = gameState.trickCards.map(a => a.card);
        receiver.cards.push(...cardsPickedUp);
        receiver.cards.sort((a, b) => {
            if (a.suit !== b.suit) {
                return SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit);
            }
            return a.value - b.value;
        });
        if (receiver.leftGame) {
            receiver.leftGame = false;
            gameState.winnerOrder = gameState.winnerOrder.filter(id => id !== receiverId);
        }
        gameState.lastCompletedTrick = [...gameState.trickCards];
        gameState.trickCards = [];
        gameState.currentSuit = null;
        nextTurnIndex = gameState.players.findIndex(p => p.id === receiverId);
    }
    else {
        const totalActivePlayers = gameState.players.filter(p => !p.leftGame).length;
        const allPlayed = gameState.trickCards.length === totalActivePlayers;
        if (allPlayed) {
            const leadSuit = gameState.currentSuit;
            let highestVal = -1;
            let winnerId = '';
            for (const action of gameState.trickCards) {
                if (action.card.suit === leadSuit && action.card.value > highestVal) {
                    highestVal = action.card.value;
                    winnerId = action.playerId;
                }
            }
            trickWinnerId = winnerId;
            gameState.lastCompletedTrick = [...gameState.trickCards];
            gameState.trickCards = [];
            gameState.currentSuit = null;
            nextTurnIndex = gameState.players.findIndex(p => p.id === winnerId);
        }
        else {
            nextTurnIndex = getNextActiveTurnIndex(gameState);
        }
    }
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
function checkPlayerCompleted(gameState, player) {
    if (player.cards.length === 0 && !player.leftGame) {
        player.leftGame = true;
        gameState.winnerOrder.push(player.id);
    }
}
function getNextActiveTurnIndex(gameState) {
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
//# sourceMappingURL=game.engine.js.map