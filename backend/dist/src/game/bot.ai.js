"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BOT_NAMES = void 0;
exports.getValidPlays = getValidPlays;
exports.pickBotCard = pickBotCard;
exports.isBotPlayer = isBotPlayer;
const game_engine_1 = require("./game.engine");
function getValidPlays(gameState, playerId) {
    const player = gameState.players.find(p => p.id === playerId);
    if (!player)
        return [];
    return player.cards.filter(card => (0, game_engine_1.isValidPlay)(gameState, playerId, card).valid);
}
function pickBotCard(gameState, playerId) {
    const validPlays = getValidPlays(gameState, playerId);
    if (validPlays.length === 0)
        return null;
    if (validPlays.length === 1)
        return validPlays[0];
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
exports.BOT_NAMES = ['CPU Ace', 'CPU King', 'CPU Queen', 'CPU Jack', 'CPU Dealer'];
function isBotPlayer(playerId) {
    return playerId.startsWith('bot-');
}
//# sourceMappingURL=bot.ai.js.map