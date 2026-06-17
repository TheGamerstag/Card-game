// backend/src/socket/game.gateway.ts
import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GameState, Player, Card } from '../game/game.types';
import { dealCards, findAceOfSpadesPlayerIndex, isValidPlay, resolvePlay, TrickResult } from '../game/game.engine';
import { BOT_NAMES, isBotPlayer, pickBotCard } from '../game/bot.ai';
import { PrismaService } from '../prisma.service';
import { Injectable } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
@Injectable()
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private rooms: Record<string, GameState> = {};
  private activeClients: Record<string, { userId: string; username: string; roomId?: string }> = {};
  private disconnectTimeouts: Record<string, NodeJS.Timeout> = {};
  private turnTimers: Record<string, NodeJS.Timeout> = {};

  constructor(private prisma: PrismaService) {}

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
    const clientData = this.activeClients[client.id];
    if (clientData && clientData.roomId) {
      const { userId, roomId } = clientData;
      this.startDisconnectTimeout(userId, roomId);
    }
    delete this.activeClients[client.id];
  }

  private startDisconnectTimeout(userId: string, roomId: string) {
    if (this.disconnectTimeouts[userId]) {
      clearTimeout(this.disconnectTimeouts[userId]);
    }
    const room = this.rooms[roomId];
    if (!room) return;
    const delay = room.status === 'LOBBY' ? 2000 : 120000; // 2 min for PLAYING
    this.disconnectTimeouts[userId] = setTimeout(() => {
      delete this.disconnectTimeouts[userId];
      this.removeUserFromRoom(userId, roomId);
    }, delay);
  }

  private removeUserFromRoom(userId: string, roomId: string) {
    const room = this.rooms[roomId];
    if (!room) return;
    const pIndex = room.players.findIndex(p => p.id === userId);
    if (pIndex !== -1) {
      const username = room.players[pIndex].username;
      room.players.splice(pIndex, 1);
      // Clean up pending requests for this user
      if (room.pendingTakeRequests) delete room.pendingTakeRequests[userId];
      if (room.pendingTradeRequests) delete room.pendingTradeRequests[userId];

      this.server.to(roomId).emit('chatMessage', {
        sender: 'System',
        text: `${username} has left the room.`,
      });

      if (room.players.length === 0 || room.players.every(p => p.isBot)) {
        delete this.rooms[roomId];
      } else {
        if (room.status === 'PLAYING' && room.currentTurn === pIndex) {
          if (room.currentTurn >= room.players.length) room.currentTurn = 0;
        }
        this.server.to(roomId).emit('roomUpdated', room);
      }
    }
  }

  @SubscribeMessage('registerGuest')
  async handleRegisterGuest(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { username: string }
  ) {
    const avatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${data.username}`;
    const user = await this.prisma.user.upsert({
      where: { username: data.username },
      update: {},
      create: { username: data.username, avatar },
    });

    this.activeClients[client.id] = { userId: user.id, username: user.username };

    // Reconnection: check if this user is in an active room
    const existingRoomId = Object.keys(this.rooms).find(roomId =>
      this.rooms[roomId].players.some(p => p.id === user.id)
    );

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
    } else {
      client.emit('registered', user);
    }
  }

  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; username: string }
  ) {
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
    } else {
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

  @SubscribeMessage('leaveRoom')
  handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() roomId: string
  ) {
    client.leave(roomId);
    const clientData = this.activeClients[client.id];
    if (clientData) {
      this.removeUserFromRoom(clientData.userId, roomId);
      delete clientData.roomId;
    }
  }

  @SubscribeMessage('toggleReady')
  handleToggleReady(@ConnectedSocket() client: Socket) {
    const clientData = this.activeClients[client.id];
    if (!clientData || !clientData.roomId) return;
    const room = this.rooms[clientData.roomId];
    if (!room) return;
    const player = room.players.find(p => p.id === clientData.userId);
    if (player) {
      player.isReady = !player.isReady;
      this.server.to(clientData.roomId).emit('roomUpdated', room);
    }
  }

  // ── Take Cards ─────────────────────────────────────────────────────────────

  @SubscribeMessage('requestTakeCards')
  handleRequestTakeCards(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { targetPlayerId: string }
  ) {
    const clientData = this.activeClients[client.id];
    if (!clientData || !clientData.roomId) return;
    const room = this.rooms[clientData.roomId];
    if (!room) return;

    // Only during play
    if (room.status !== 'PLAYING') {
      client.emit('error', 'Take cards is only available during active play.');
      return;
    }

    // Requester must be current turn player
    const requesterId = clientData.userId;
    const currentTurnPlayer = room.players[room.currentTurn];
    if (!currentTurnPlayer || currentTurnPlayer.id !== requesterId) {
      client.emit('error', 'You can only request to take cards on your turn.');
      return;
    }

    // All players must have made at least 2 moves
    const allPlayedTwoMoves = room.players.every(p => p.leftGame || (p.movesCount || 0) >= 2);
    if (!allPlayedTwoMoves) {
      client.emit('error', 'Take cards is only allowed after all players have made at least 2 moves.');
      return;
    }

    const targetId = data.targetPlayerId;
    const requester = room.players.find(p => p.id === requesterId);
    const target = room.players.find(p => p.id === targetId);
    if (!requester || !target || target.leftGame) return;

    room.pendingTakeRequests = room.pendingTakeRequests || {};
    room.pendingTakeRequests[targetId] = requesterId;

    if (target.isBot) {
      // Simulate CPU automatic acceptance after a short delay
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

  private executeBotAcceptTakeCards(roomId: string, targetId: string, requesterId: string) {
    const room = this.rooms[roomId];
    if (!room) return;

    const requester = room.players.find(p => p.id === requesterId);
    const target = room.players.find(p => p.id === targetId);
    if (!requester || !target) return;

    // Perform the card takeover
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

  @SubscribeMessage('respondTakeCards')
  handleRespondTakeCards(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { targetPlayerId: string; accept: boolean }
  ) {
    const clientData = this.activeClients[client.id];
    if (!clientData || !clientData.roomId) return;
    const room = this.rooms[clientData.roomId];
    if (!room) return;

    const targetId = data.targetPlayerId;
    const requesterId = room.pendingTakeRequests?.[targetId];
    if (!requesterId) return;

    const requester = room.players.find(p => p.id === requesterId);
    const target = room.players.find(p => p.id === targetId);
    if (!requester || !target) return;

    if (data.accept) {
      requester.cards.push(...target.cards);
      target.cards = [];
      target.leftGame = true;
      room.winnerOrder.push(target.id);
      this.server.to(room.roomId).emit('chatMessage', {
        sender: 'System',
        text: `${target.username} accepted the card takeover from ${requester.username} and finished in position #${room.winnerOrder.length}.`,
      });
    } else {
      const requesterSocketId = Object.entries(this.activeClients)
        .find(([, v]) => v.userId === requesterId && v.roomId === room.roomId)?.[0];
      if (requesterSocketId) {
        this.server.to(requesterSocketId).emit('chatMessage', {
          sender: 'System',
          text: `${target.username} declined your card takeover request.`,
        });
      }
    }

    delete room.pendingTakeRequests![targetId];
    this.server.to(room.roomId).emit('roomUpdated', room);
  }

  // ── Trade Cards ────────────────────────────────────────────────────────────

  @SubscribeMessage('requestTradeCards')
  handleRequestTradeCards(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { targetPlayerId: string; offeredCardId: number; requestedCardId: number }
  ) {
    const clientData = this.activeClients[client.id];
    if (!clientData || !clientData.roomId) return;
    const room = this.rooms[clientData.roomId];
    if (!room || room.status !== 'LOBBY') return;

    const requesterId = clientData.userId;
    const { targetPlayerId: targetId, offeredCardId, requestedCardId } = data;
    const requester = room.players.find(p => p.id === requesterId);
    const target = room.players.find(p => p.id === targetId);
    if (!requester || !target || target.leftGame) return;

    // Verify requester owns the offered card
    const offeredCard = requester.cards.find(c => c.id === offeredCardId);
    const requestedCard = target.cards.find(c => c.id === requestedCardId);
    if (!offeredCard || !requestedCard) return;

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

  @SubscribeMessage('respondTradeCards')
  handleRespondTradeCards(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { targetPlayerId: string; accept: boolean }
  ) {
    const clientData = this.activeClients[client.id];
    if (!clientData || !clientData.roomId) return;
    const room = this.rooms[clientData.roomId];
    if (!room) return;

    const targetId = data.targetPlayerId;
    const pending = room.pendingTradeRequests?.[targetId];
    if (!pending) return;

    const requester = room.players.find(p => p.id === pending.requesterId);
    const target = room.players.find(p => p.id === targetId);
    if (!requester || !target) return;

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
    } else {
      const requesterSocketId = Object.entries(this.activeClients)
        .find(([, v]) => v.userId === pending.requesterId && v.roomId === room.roomId)?.[0];
      if (requesterSocketId) {
        this.server.to(requesterSocketId).emit('chatMessage', {
          sender: 'System',
          text: `${target.username} declined your trade request.`,
        });
      }
    }

    delete room.pendingTradeRequests![targetId];
    this.server.to(room.roomId).emit('roomUpdated', room);
  }

  // ── Play Again ─────────────────────────────────────────────────────────────

  @SubscribeMessage('playAgainReady')
  handlePlayAgainReady(@ConnectedSocket() client: Socket) {
    const clientData = this.activeClients[client.id];
    if (!clientData || !clientData.roomId) return;
    const room = this.rooms[clientData.roomId];
    if (!room || room.status !== 'GAME_OVER') return;

    const player = room.players.find(p => p.id === clientData.userId);
    if (!player) return;

    player.isReadyForNext = true;
    this.server.to(clientData.roomId).emit('roomUpdated', room);
    this.maybeStartNextMatch(room.roomId);
  }

  private maybeStartNextMatch(roomId: string) {
    const room = this.rooms[roomId];
    if (!room) return;
    const readyPlayers = room.players.filter(p => p.isReadyForNext);
    if (readyPlayers.length < 3) return;

    // Keep only ready players, reset state
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

  // ── Bot Game ───────────────────────────────────────────────────────────────

  @SubscribeMessage('startBotGame')
  handleStartBotGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { totalPlayers: number }
  ) {
    const clientData = this.activeClients[client.id];
    if (!clientData) return;

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

    const humanPlayer: Player = {
      id: clientData.userId,
      username: clientData.username,
      avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${clientData.username}`,
      cards: [],
      isReady: true,
      leftGame: false,
      isBot: false,
    };

    const botCount = totalPlayers - 1;
    const bots: Player[] = Array.from({ length: botCount }, (_, i) => ({
      id: `bot-${roomId}-${i}`,
      username: BOT_NAMES[i] || `CPU ${i + 1}`,
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
    dealCards(room.players);
    room.status = 'PLAYING';
    room.winnerOrder = [];
    room.loserId = null;
    room.trickCards = [];
    room.currentSuit = null;

    const starterIdx = findAceOfSpadesPlayerIndex(room.players);
    room.currentTurn = starterIdx !== -1 ? starterIdx : 0;

    this.startTurnTimer(roomId);
    this.server.to(roomId).emit('chatMessage', {
      sender: 'System',
      text: `Bot game started with ${totalPlayers} players (${botCount} CPU). Ace of Spades must lead.`,
    });

    void this.processBotTurns(roomId);
  }

  @SubscribeMessage('startGame')
  handleStartGame(@ConnectedSocket() client: Socket) {
    const clientData = this.activeClients[client.id];
    if (!clientData || !clientData.roomId) return;
    const room = this.rooms[clientData.roomId];
    if (!room) return;

    if (room.players.length < 3) {
      client.emit('error', 'Requires at least 3 players to start!');
      return;
    }

    dealCards(room.players);
    room.status = 'PLAYING';
    room.winnerOrder = [];
    room.loserId = null;
    room.trickCards = [];
    room.currentSuit = null;
    room.lastCompletedTrick = null;
    room.pendingTakeRequests = {};
    room.pendingTradeRequests = {};

    const starterIdx = findAceOfSpadesPlayerIndex(room.players);
    room.currentTurn = starterIdx !== -1 ? starterIdx : 0;

    this.startTurnTimer(clientData.roomId);
    this.server.to(clientData.roomId).emit('chatMessage', {
      sender: 'System',
      text: 'Game has started! Ace of Spades must lead.',
    });
  }

  @SubscribeMessage('playCard')
  async handlePlayCard(
    @ConnectedSocket() client: Socket,
    @MessageBody() card: any
  ) {
    const clientData = this.activeClients[client.id];
    if (!clientData || !clientData.roomId) return;
    const room = this.rooms[clientData.roomId];
    if (!room) return;

    const valResult = isValidPlay(room, clientData.userId, card);
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

  @SubscribeMessage('sendMessage')
  handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() message: string
  ) {
    const clientData = this.activeClients[client.id];
    if (!clientData || !clientData.roomId) return;
    this.server.to(clientData.roomId).emit('chatMessage', {
      sender: clientData.username,
      text: message,
    });
  }

  @SubscribeMessage('emojiReaction')
  handleEmojiReaction(
    @ConnectedSocket() client: Socket,
    @MessageBody() emoji: string
  ) {
    const clientData = this.activeClients[client.id];
    if (!clientData || !clientData.roomId) return;
    this.server.to(clientData.roomId).emit('reaction', {
      playerId: clientData.userId,
      emoji,
    });
  }

  private startTurnTimer(roomId: string) {
    this.clearTurnTimer(roomId);

    const room = this.rooms[roomId];
    if (!room || room.status !== 'PLAYING') return;

    room.turnStartedAt = Date.now();
    this.server.to(roomId).emit('roomUpdated', room);

    this.turnTimers[roomId] = setTimeout(() => {
      this.handleTurnTimeout(roomId);
    }, 20000);
  }

  private clearTurnTimer(roomId: string) {
    if (this.turnTimers[roomId]) {
      clearTimeout(this.turnTimers[roomId]);
      delete this.turnTimers[roomId];
    }
  }

  private handleTurnTimeout(roomId: string) {
    const room = this.rooms[roomId];
    if (!room || room.status !== 'PLAYING') return;

    const currentPlayer = room.players[room.currentTurn];
    if (!currentPlayer || currentPlayer.leftGame) return;

    // Pick a card to play automatically
    const validCards = currentPlayer.cards.filter(
      c => isValidPlay(room, currentPlayer.id, c).valid
    );

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

  private executePlay(roomId: string, playerId: string, card: Card): TrickResult | null {
    const room = this.rooms[roomId];
    if (!room || room.status !== 'PLAYING') return null;

    const valResult = isValidPlay(room, playerId, card);
    if (!valResult.valid) return null;

    const player = room.players.find(p => p.id === playerId);
    if (player) {
      player.movesCount = (player.movesCount || 0) + 1;
    }

    const trickRes = resolvePlay(room, playerId, card);
    this.startTurnTimer(roomId);

    const playerName = room.players.find(p => p.id === playerId)?.username || 'Someone';

    if (trickRes.thullaTriggered) {
      const receiverName = room.players.find(p => p.id === trickRes.thullaReceiverId)?.username || 'Someone';
      this.server.to(roomId).emit('chatMessage', {
        sender: 'System',
        text: `Thulla! ${playerName} broke suit. ${receiverName} picked up all cards.`,
      });
    } else if (trickRes.trickWinnerId) {
      const winnerName = room.players.find(p => p.id === trickRes.trickWinnerId)?.username || 'Someone';
      this.server.to(roomId).emit('chatMessage', {
        sender: 'System',
        text: `${winnerName} won the trick.`,
      });
    }

    return trickRes;
  }

  private async processBotTurns(roomId: string): Promise<void> {
    const room = this.rooms[roomId];
    if (!room || room.status !== 'PLAYING' || !room.isBotRoom) return;

    while (room.status === 'PLAYING') {
      const currentPlayer = room.players[room.currentTurn];
      if (!currentPlayer || !isBotPlayer(currentPlayer.id)) break;

      await new Promise(resolve => setTimeout(resolve, 700));

      const activeRoom = this.rooms[roomId];
      if (!activeRoom || activeRoom.status !== 'PLAYING') return;

      const bot = activeRoom.players[activeRoom.currentTurn];
      if (!bot || !isBotPlayer(bot.id)) return;

      const card = pickBotCard(activeRoom, bot.id);
      if (!card) return;

      const trickRes = this.executePlay(roomId, bot.id, card);
      if (!trickRes) return;

      if (trickRes.gameOver && activeRoom.loserId) {
        await this.persistGameResults(activeRoom);
        return;
      }
    }
  }

  private async persistGameResults(room: GameState) {
    this.clearTurnTimer(room.roomId);
    try {
      const dbMatch = await this.prisma.match.create({
        data: { roomCode: room.roomId, status: 'COMPLETED' },
      });

      for (const p of room.players) {
        if (p.isBot) continue;
        const uRec = await this.prisma.user.findUnique({ where: { username: p.username } });
        if (uRec) {
          const isWinner = room.winnerOrder[0] === p.id;
          const isLoser = room.loserId === p.id;
          let coinsChange = 10;
          let xpEarned = 50;
          let rankChange = 5;
          if (isWinner) { coinsChange = 100; xpEarned = 250; rankChange = 25; }
          else if (isLoser) { coinsChange = -50; xpEarned = 10; rankChange = -15; }

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
    } catch (err) {
      console.error('Failed to persist game results:', err);
    }
  }
}
