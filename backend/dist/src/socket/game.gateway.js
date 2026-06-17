"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const game_engine_1 = require("../game/game.engine");
const bot_ai_1 = require("../game/bot.ai");
const prisma_service_1 = require("../prisma.service");
const common_1 = require("@nestjs/common");
let GameGateway = class GameGateway {
    prisma;
    server;
    rooms = {};
    activeClients = {};
    disconnectTimeouts = {};
    turnTimers = {};
    constructor(prisma) {
        this.prisma = prisma;
    }
    handleConnection(client) {
        console.log(`Client connected: ${client.id}`);
    }
    handleDisconnect(client) {
        console.log(`Client disconnected: ${client.id}`);
        const clientData = this.activeClients[client.id];
        if (clientData && clientData.roomId) {
            const { userId, roomId } = clientData;
            this.startDisconnectTimeout(userId, roomId);
        }
        delete this.activeClients[client.id];
    }
    startDisconnectTimeout(userId, roomId) {
        if (this.disconnectTimeouts[userId]) {
            clearTimeout(this.disconnectTimeouts[userId]);
        }
        const room = this.rooms[roomId];
        if (!room)
            return;
        const delay = room.status === 'LOBBY' ? 2000 : 15000;
        this.disconnectTimeouts[userId] = setTimeout(() => {
            delete this.disconnectTimeouts[userId];
            this.removeUserFromRoom(userId, roomId);
        }, delay);
    }
    removeUserFromRoom(userId, roomId) {
        const room = this.rooms[roomId];
        if (!room)
            return;
        const pIndex = room.players.findIndex(p => p.id === userId);
        if (pIndex !== -1) {
            const username = room.players[pIndex].username;
            room.players.splice(pIndex, 1);
            if (room.pendingTakeRequests)
                delete room.pendingTakeRequests[userId];
            if (room.pendingTradeRequests)
                delete room.pendingTradeRequests[userId];
            this.server.to(roomId).emit('chatMessage', {
                sender: 'System',
                text: `${username} has left the room.`,
            });
            if (room.players.length === 0 || room.players.every(p => p.isBot)) {
                delete this.rooms[roomId];
            }
            else {
                if (room.status === 'PLAYING' && room.currentTurn === pIndex) {
                    if (room.currentTurn >= room.players.length)
                        room.currentTurn = 0;
                }
                this.server.to(roomId).emit('roomUpdated', room);
            }
        }
    }
    async handleRegisterGuest(client, data) {
        const avatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${data.username}`;
        const user = await this.prisma.user.upsert({
            where: { username: data.username },
            update: {},
            create: { username: data.username, avatar },
        });
        this.activeClients[client.id] = { userId: user.id, username: user.username };
        const existingRoomId = Object.keys(this.rooms).find(roomId => this.rooms[roomId].players.some(p => p.id === user.id));
        if (existingRoomId) {
            if (this.disconnectTimeouts[user.id]) {
                clearTimeout(this.disconnectTimeouts[user.id]);
                delete this.disconnectTimeouts[user.id];
            }
            this.activeClients[client.id].roomId = existingRoomId;
            client.join(existingRoomId);
            client.emit('registered', user);
            this.server.to(existingRoomId).emit('roomUpdated', this.rooms[existingRoomId]);
            this.server.to(existingRoomId).emit('chatMessage', {
                sender: 'System',
                text: `${user.username} has reconnected.`,
            });
        }
        else {
            client.emit('registered', user);
        }
    }
    async handleJoinRoom(client, data) {
        const { roomId, username } = data;
        let clientData = this.activeClients[client.id];
        if (!clientData) {
            const avatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`;
            const user = await this.prisma.user.upsert({
                where: { username },
                update: {},
                create: { username, avatar },
            });
            clientData = { userId: user.id, username: user.username, roomId };
            this.activeClients[client.id] = clientData;
        }
        else {
            clientData.roomId = roomId;
        }
        client.join(roomId);
        if (!this.rooms[roomId]) {
            this.rooms[roomId] = {
                roomId,
                players: [],
                status: 'LOBBY',
                deck: [],
                currentTurn: 0,
                currentSuit: null,
                trickCards: [],
                loserId: null,
                winnerOrder: [],
                lastCompletedTrick: null,
                pendingTakeRequests: {},
                pendingTradeRequests: {},
            };
        }
        const room = this.rooms[roomId];
        if (!room.players.some(p => p.id === clientData.userId)) {
            room.players.push({
                id: clientData.userId,
                username: clientData.username,
                avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${clientData.username}`,
                cards: [],
                isReady: false,
                leftGame: false,
            });
        }
        this.server.to(roomId).emit('roomUpdated', room);
        this.server.to(roomId).emit('chatMessage', {
            sender: 'System',
            text: `${clientData.username} has joined the room.`,
        });
    }
    handleLeaveRoom(client, roomId) {
        client.leave(roomId);
        const clientData = this.activeClients[client.id];
        if (clientData) {
            this.removeUserFromRoom(clientData.userId, roomId);
            delete clientData.roomId;
        }
    }
    handleToggleReady(client) {
        const clientData = this.activeClients[client.id];
        if (!clientData || !clientData.roomId)
            return;
        const room = this.rooms[clientData.roomId];
        if (!room)
            return;
        const player = room.players.find(p => p.id === clientData.userId);
        if (player) {
            player.isReady = !player.isReady;
            this.server.to(clientData.roomId).emit('roomUpdated', room);
        }
    }
    handleRequestTakeCards(client, data) {
        const clientData = this.activeClients[client.id];
        if (!clientData || !clientData.roomId)
            return;
        const room = this.rooms[clientData.roomId];
        if (!room)
            return;
        if (room.status !== 'PLAYING') {
            client.emit('error', 'Take cards is only available during active play.');
            return;
        }
        const requesterId = clientData.userId;
        const currentTurnPlayer = room.players[room.currentTurn];
        if (!currentTurnPlayer || currentTurnPlayer.id !== requesterId) {
            client.emit('error', 'You can only request to take cards on your turn.');
            return;
        }
        const allPlayedTwoMoves = room.players.every(p => p.leftGame || (p.movesCount || 0) >= 2);
        if (!allPlayedTwoMoves) {
            client.emit('error', 'Take cards is only allowed after all players have made at least 2 moves.');
            return;
        }
        const targetId = data.targetPlayerId;
        const requester = room.players.find(p => p.id === requesterId);
        const target = room.players.find(p => p.id === targetId);
        if (!requester || !target || target.leftGame)
            return;
        room.pendingTakeRequests = room.pendingTakeRequests || {};
        room.pendingTakeRequests[targetId] = requesterId;
        if (target.isBot) {
            setTimeout(() => {
                const currentRoom = this.rooms[room.roomId];
                if (currentRoom && currentRoom.pendingTakeRequests?.[targetId] === requesterId) {
                    this.executeBotAcceptTakeCards(room.roomId, targetId, requesterId);
                }
            }, 1000);
            return;
        }
        const targetSocketId = Object.entries(this.activeClients)
            .find(([, v]) => v.userId === targetId && v.roomId === room.roomId)?.[0];
        if (targetSocketId) {
            this.server.to(targetSocketId).emit('takeCardsRequest', {
                requesterId,
                requesterName: requester.username,
            });
        }
    }
    executeBotAcceptTakeCards(roomId, targetId, requesterId) {
        const room = this.rooms[roomId];
        if (!room)
            return;
        const requester = room.players.find(p => p.id === requesterId);
        const target = room.players.find(p => p.id === targetId);
        if (!requester || !target)
            return;
        requester.cards.push(...target.cards);
        target.cards = [];
        target.leftGame = true;
        room.winnerOrder.push(target.id);
        this.server.to(room.roomId).emit('chatMessage', {
            sender: 'System',
            text: `${target.username} (CPU) accepted the card takeover from ${requester.username} and finished in position #${room.winnerOrder.length}.`,
        });
        if (room.pendingTakeRequests) {
            delete room.pendingTakeRequests[targetId];
        }
        this.server.to(room.roomId).emit('roomUpdated', room);
    }
    handleRespondTakeCards(client, data) {
        const clientData = this.activeClients[client.id];
        if (!clientData || !clientData.roomId)
            return;
        const room = this.rooms[clientData.roomId];
        if (!room)
            return;
        const targetId = data.targetPlayerId;
        const requesterId = room.pendingTakeRequests?.[targetId];
        if (!requesterId)
            return;
        const requester = room.players.find(p => p.id === requesterId);
        const target = room.players.find(p => p.id === targetId);
        if (!requester || !target)
            return;
        if (data.accept) {
            requester.cards.push(...target.cards);
            target.cards = [];
            target.leftGame = true;
            room.winnerOrder.push(target.id);
            this.server.to(room.roomId).emit('chatMessage', {
                sender: 'System',
                text: `${target.username} accepted the card takeover from ${requester.username} and finished in position #${room.winnerOrder.length}.`,
            });
        }
        else {
            const requesterSocketId = Object.entries(this.activeClients)
                .find(([, v]) => v.userId === requesterId && v.roomId === room.roomId)?.[0];
            if (requesterSocketId) {
                this.server.to(requesterSocketId).emit('chatMessage', {
                    sender: 'System',
                    text: `${target.username} declined your card takeover request.`,
                });
            }
        }
        delete room.pendingTakeRequests[targetId];
        this.server.to(room.roomId).emit('roomUpdated', room);
    }
    handleRequestTradeCards(client, data) {
        const clientData = this.activeClients[client.id];
        if (!clientData || !clientData.roomId)
            return;
        const room = this.rooms[clientData.roomId];
        if (!room || room.status !== 'LOBBY')
            return;
        const requesterId = clientData.userId;
        const { targetPlayerId: targetId, offeredCardId, requestedCardId } = data;
        const requester = room.players.find(p => p.id === requesterId);
        const target = room.players.find(p => p.id === targetId);
        if (!requester || !target || target.leftGame)
            return;
        const offeredCard = requester.cards.find(c => c.id === offeredCardId);
        const requestedCard = target.cards.find(c => c.id === requestedCardId);
        if (!offeredCard || !requestedCard)
            return;
        room.pendingTradeRequests = room.pendingTradeRequests || {};
        room.pendingTradeRequests[targetId] = { requesterId, offeredCardId, requestedCardId };
        const targetSocketId = Object.entries(this.activeClients)
            .find(([, v]) => v.userId === targetId && v.roomId === room.roomId)?.[0];
        if (targetSocketId) {
            this.server.to(targetSocketId).emit('tradeRequest', {
                requesterId,
                requesterName: requester.username,
                targetId,
                offeredCardId,
                requestedCardId,
                offeredCard,
                requestedCard,
            });
        }
    }
    handleRespondTradeCards(client, data) {
        const clientData = this.activeClients[client.id];
        if (!clientData || !clientData.roomId)
            return;
        const room = this.rooms[clientData.roomId];
        if (!room)
            return;
        const targetId = data.targetPlayerId;
        const pending = room.pendingTradeRequests?.[targetId];
        if (!pending)
            return;
        const requester = room.players.find(p => p.id === pending.requesterId);
        const target = room.players.find(p => p.id === targetId);
        if (!requester || !target)
            return;
        if (data.accept) {
            const offeredIdx = requester.cards.findIndex(c => c.id === pending.offeredCardId);
            const requestedIdx = target.cards.findIndex(c => c.id === pending.requestedCardId);
            if (offeredIdx !== -1 && requestedIdx !== -1) {
                const offeredCard = requester.cards[offeredIdx];
                const requestedCard = target.cards[requestedIdx];
                requester.cards[offeredIdx] = requestedCard;
                target.cards[requestedIdx] = offeredCard;
                this.server.to(room.roomId).emit('chatMessage', {
                    sender: 'System',
                    text: `${requester.username} traded ${offeredCard.code} for ${target.username}'s ${requestedCard.code}.`,
                });
            }
        }
        else {
            const requesterSocketId = Object.entries(this.activeClients)
                .find(([, v]) => v.userId === pending.requesterId && v.roomId === room.roomId)?.[0];
            if (requesterSocketId) {
                this.server.to(requesterSocketId).emit('chatMessage', {
                    sender: 'System',
                    text: `${target.username} declined your trade request.`,
                });
            }
        }
        delete room.pendingTradeRequests[targetId];
        this.server.to(room.roomId).emit('roomUpdated', room);
    }
    handlePlayAgainReady(client) {
        const clientData = this.activeClients[client.id];
        if (!clientData || !clientData.roomId)
            return;
        const room = this.rooms[clientData.roomId];
        if (!room || room.status !== 'GAME_OVER')
            return;
        const player = room.players.find(p => p.id === clientData.userId);
        if (!player)
            return;
        player.isReadyForNext = true;
        this.server.to(clientData.roomId).emit('roomUpdated', room);
        this.maybeStartNextMatch(room.roomId);
    }
    maybeStartNextMatch(roomId) {
        const room = this.rooms[roomId];
        if (!room)
            return;
        const readyPlayers = room.players.filter(p => p.isReadyForNext);
        if (readyPlayers.length < 3)
            return;
        room.players = readyPlayers.map(p => ({
            ...p,
            cards: [],
            isReady: false,
            isReadyForNext: false,
            leftGame: false,
            movesCount: 0,
        }));
        room.status = 'LOBBY';
        room.deck = [];
        room.currentTurn = 0;
        room.currentSuit = null;
        room.trickCards = [];
        room.loserId = null;
        room.winnerOrder = [];
        room.lastCompletedTrick = null;
        room.pendingTakeRequests = {};
        room.pendingTradeRequests = {};
        this.server.to(roomId).emit('roomUpdated', room);
        this.server.to(roomId).emit('chatMessage', {
            sender: 'System',
            text: `New match starting with ${readyPlayers.length} players. Get ready!`,
        });
    }
    handleStartBotGame(client, data) {
        const clientData = this.activeClients[client.id];
        if (!clientData)
            return;
        const totalPlayers = data?.totalPlayers ?? 0;
        if (totalPlayers < 3 || totalPlayers > 6) {
            client.emit('error', 'Choose 3 to 6 total players for a bot game.');
            return;
        }
        if (clientData.roomId) {
            this.handleLeaveRoom(client, clientData.roomId);
        }
        const roomId = `BOT-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        clientData.roomId = roomId;
        this.activeClients[client.id] = clientData;
        client.join(roomId);
        const humanPlayer = {
            id: clientData.userId,
            username: clientData.username,
            avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${clientData.username}`,
            cards: [],
            isReady: true,
            leftGame: false,
            isBot: false,
        };
        const botCount = totalPlayers - 1;
        const bots = Array.from({ length: botCount }, (_, i) => ({
            id: `bot-${roomId}-${i}`,
            username: bot_ai_1.BOT_NAMES[i] || `CPU ${i + 1}`,
            avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=bot${i}`,
            cards: [],
            isReady: true,
            leftGame: false,
            isBot: true,
        }));
        this.rooms[roomId] = {
            roomId,
            players: [humanPlayer, ...bots],
            status: 'LOBBY',
            deck: [],
            currentTurn: 0,
            currentSuit: null,
            trickCards: [],
            loserId: null,
            winnerOrder: [],
            isBotRoom: true,
            lastCompletedTrick: null,
            pendingTakeRequests: {},
            pendingTradeRequests: {},
        };
        const room = this.rooms[roomId];
        (0, game_engine_1.dealCards)(room.players);
        room.status = 'PLAYING';
        room.winnerOrder = [];
        room.loserId = null;
        room.trickCards = [];
        room.currentSuit = null;
        const starterIdx = (0, game_engine_1.findAceOfSpadesPlayerIndex)(room.players);
        room.currentTurn = starterIdx !== -1 ? starterIdx : 0;
        this.startTurnTimer(roomId);
        this.server.to(roomId).emit('chatMessage', {
            sender: 'System',
            text: `Bot game started with ${totalPlayers} players (${botCount} CPU). Ace of Spades must lead.`,
        });
        void this.processBotTurns(roomId);
    }
    handleStartGame(client) {
        const clientData = this.activeClients[client.id];
        if (!clientData || !clientData.roomId)
            return;
        const room = this.rooms[clientData.roomId];
        if (!room)
            return;
        if (room.players.length < 3) {
            client.emit('error', 'Requires at least 3 players to start!');
            return;
        }
        (0, game_engine_1.dealCards)(room.players);
        room.status = 'PLAYING';
        room.winnerOrder = [];
        room.loserId = null;
        room.trickCards = [];
        room.currentSuit = null;
        room.lastCompletedTrick = null;
        room.pendingTakeRequests = {};
        room.pendingTradeRequests = {};
        const starterIdx = (0, game_engine_1.findAceOfSpadesPlayerIndex)(room.players);
        room.currentTurn = starterIdx !== -1 ? starterIdx : 0;
        this.startTurnTimer(clientData.roomId);
        this.server.to(clientData.roomId).emit('chatMessage', {
            sender: 'System',
            text: 'Game has started! Ace of Spades must lead.',
        });
    }
    async handlePlayCard(client, card) {
        const clientData = this.activeClients[client.id];
        if (!clientData || !clientData.roomId)
            return;
        const room = this.rooms[clientData.roomId];
        if (!room)
            return;
        const valResult = (0, game_engine_1.isValidPlay)(room, clientData.userId, card);
        if (!valResult.valid) {
            client.emit('error', valResult.reason || 'Invalid Play');
            return;
        }
        const trickRes = this.executePlay(clientData.roomId, clientData.userId, card);
        if (!trickRes) {
            client.emit('error', 'Invalid Play');
            return;
        }
        if (trickRes.gameOver && room.loserId) {
            await this.persistGameResults(room);
            return;
        }
        void this.processBotTurns(clientData.roomId);
    }
    handleSendMessage(client, message) {
        const clientData = this.activeClients[client.id];
        if (!clientData || !clientData.roomId)
            return;
        this.server.to(clientData.roomId).emit('chatMessage', {
            sender: clientData.username,
            text: message,
        });
    }
    handleEmojiReaction(client, emoji) {
        const clientData = this.activeClients[client.id];
        if (!clientData || !clientData.roomId)
            return;
        this.server.to(clientData.roomId).emit('reaction', {
            playerId: clientData.userId,
            emoji,
        });
    }
    startTurnTimer(roomId) {
        this.clearTurnTimer(roomId);
        const room = this.rooms[roomId];
        if (!room || room.status !== 'PLAYING')
            return;
        room.turnStartedAt = Date.now();
        this.server.to(roomId).emit('roomUpdated', room);
        this.turnTimers[roomId] = setTimeout(() => {
            this.handleTurnTimeout(roomId);
        }, 20000);
    }
    clearTurnTimer(roomId) {
        if (this.turnTimers[roomId]) {
            clearTimeout(this.turnTimers[roomId]);
            delete this.turnTimers[roomId];
        }
    }
    handleTurnTimeout(roomId) {
        const room = this.rooms[roomId];
        if (!room || room.status !== 'PLAYING')
            return;
        const currentPlayer = room.players[room.currentTurn];
        if (!currentPlayer || currentPlayer.leftGame)
            return;
        const validCards = currentPlayer.cards.filter(c => (0, game_engine_1.isValidPlay)(room, currentPlayer.id, c).valid);
        if (validCards.length > 0) {
            const cardToPlay = validCards[Math.floor(Math.random() * validCards.length)];
            this.server.to(roomId).emit('chatMessage', {
                sender: 'System',
                text: `${currentPlayer.username}'s turn timed out. Auto-playing ${cardToPlay.code}.`,
            });
            const trickRes = this.executePlay(roomId, currentPlayer.id, cardToPlay);
            if (trickRes && trickRes.gameOver && room.loserId) {
                void this.persistGameResults(room);
                return;
            }
        }
        void this.processBotTurns(roomId);
    }
    executePlay(roomId, playerId, card) {
        const room = this.rooms[roomId];
        if (!room || room.status !== 'PLAYING')
            return null;
        const valResult = (0, game_engine_1.isValidPlay)(room, playerId, card);
        if (!valResult.valid)
            return null;
        const player = room.players.find(p => p.id === playerId);
        if (player) {
            player.movesCount = (player.movesCount || 0) + 1;
        }
        const trickRes = (0, game_engine_1.resolvePlay)(room, playerId, card);
        this.startTurnTimer(roomId);
        const playerName = room.players.find(p => p.id === playerId)?.username || 'Someone';
        if (trickRes.thullaTriggered) {
            const receiverName = room.players.find(p => p.id === trickRes.thullaReceiverId)?.username || 'Someone';
            this.server.to(roomId).emit('chatMessage', {
                sender: 'System',
                text: `Thulla! ${playerName} broke suit. ${receiverName} picked up all cards.`,
            });
        }
        else if (trickRes.trickWinnerId) {
            const winnerName = room.players.find(p => p.id === trickRes.trickWinnerId)?.username || 'Someone';
            this.server.to(roomId).emit('chatMessage', {
                sender: 'System',
                text: `${winnerName} won the trick.`,
            });
        }
        return trickRes;
    }
    async processBotTurns(roomId) {
        const room = this.rooms[roomId];
        if (!room || room.status !== 'PLAYING' || !room.isBotRoom)
            return;
        while (room.status === 'PLAYING') {
            const currentPlayer = room.players[room.currentTurn];
            if (!currentPlayer || !(0, bot_ai_1.isBotPlayer)(currentPlayer.id))
                break;
            await new Promise(resolve => setTimeout(resolve, 700));
            const activeRoom = this.rooms[roomId];
            if (!activeRoom || activeRoom.status !== 'PLAYING')
                return;
            const bot = activeRoom.players[activeRoom.currentTurn];
            if (!bot || !(0, bot_ai_1.isBotPlayer)(bot.id))
                return;
            const card = (0, bot_ai_1.pickBotCard)(activeRoom, bot.id);
            if (!card)
                return;
            const trickRes = this.executePlay(roomId, bot.id, card);
            if (!trickRes)
                return;
            if (trickRes.gameOver && activeRoom.loserId) {
                await this.persistGameResults(activeRoom);
                return;
            }
        }
    }
    async persistGameResults(room) {
        this.clearTurnTimer(room.roomId);
        try {
            const dbMatch = await this.prisma.match.create({
                data: { roomCode: room.roomId, status: 'COMPLETED' },
            });
            for (const p of room.players) {
                if (p.isBot)
                    continue;
                const uRec = await this.prisma.user.findUnique({ where: { username: p.username } });
                if (uRec) {
                    const isWinner = room.winnerOrder[0] === p.id;
                    const isLoser = room.loserId === p.id;
                    let coinsChange = 10;
                    let xpEarned = 50;
                    let rankChange = 5;
                    if (isWinner) {
                        coinsChange = 100;
                        xpEarned = 250;
                        rankChange = 25;
                    }
                    else if (isLoser) {
                        coinsChange = -50;
                        xpEarned = 10;
                        rankChange = -15;
                    }
                    await this.prisma.user.update({
                        where: { id: uRec.id },
                        data: {
                            coins: { increment: coinsChange },
                            xp: { increment: xpEarned },
                            wins: isWinner ? { increment: 1 } : undefined,
                            losses: isLoser ? { increment: 1 } : undefined,
                            rank: { increment: rankChange },
                        },
                    });
                    await this.prisma.matchPlayer.create({
                        data: { matchId: dbMatch.id, userId: uRec.id, isWinner, xpEarned, coinsChange, rankChange },
                    });
                }
            }
            this.server.to(room.roomId).emit('gameOver', {
                winnerOrder: room.winnerOrder,
                loserId: room.loserId,
            });
        }
        catch (err) {
            console.error('Failed to persist game results:', err);
        }
    }
};
exports.GameGateway = GameGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], GameGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('registerGuest'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], GameGateway.prototype, "handleRegisterGuest", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('joinRoom'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], GameGateway.prototype, "handleJoinRoom", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('leaveRoom'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, String]),
    __metadata("design:returntype", void 0)
], GameGateway.prototype, "handleLeaveRoom", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('toggleReady'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], GameGateway.prototype, "handleToggleReady", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('requestTakeCards'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], GameGateway.prototype, "handleRequestTakeCards", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('respondTakeCards'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], GameGateway.prototype, "handleRespondTakeCards", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('requestTradeCards'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], GameGateway.prototype, "handleRequestTradeCards", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('respondTradeCards'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], GameGateway.prototype, "handleRespondTradeCards", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('playAgainReady'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], GameGateway.prototype, "handlePlayAgainReady", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('startBotGame'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], GameGateway.prototype, "handleStartBotGame", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('startGame'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], GameGateway.prototype, "handleStartGame", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('playCard'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], GameGateway.prototype, "handlePlayCard", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('sendMessage'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, String]),
    __metadata("design:returntype", void 0)
], GameGateway.prototype, "handleSendMessage", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('emojiReaction'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, String]),
    __metadata("design:returntype", void 0)
], GameGateway.prototype, "handleEmojiReaction", null);
exports.GameGateway = GameGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: {
            origin: '*',
        },
    }),
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], GameGateway);
//# sourceMappingURL=game.gateway.js.map