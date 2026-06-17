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

  // In-memory active rooms state
  private rooms: Record<string, GameState> = {};
  
  // Maps socket.id to user database record details and current roomId
  private activeClients: Record<string, { userId: string; username: string; roomId?: string }> = {};

  // Disconnect timeouts for users (keyed by userId)
  private disconnectTimeouts: Record<string, NodeJS.Timeout> = {};

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

    // 2s delay in lobby, 15s delay in playing
    const delay = room.status === 'LOBBY' ? 2000 : 15000;

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
      
      this.server.to(roomId).emit('chatMessage', {
        sender: 'System',
        text: `${username} has left the room.`,
      });

      if (room.players.length === 0 || room.players.every(p => p.isBot)) {
        delete this.rooms[roomId];
      } else {
        if (room.status === 'PLAYING' && room.currentTurn === pIndex) {
          if (room.currentTurn >= room.players.length) {
            room.currentTurn = 0;
          }
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
      create: {
        username: data.username,
        avatar,
      },
    });

    this.activeClients[client.id] = {
      userId: user.id,
      username: user.username,
    };

    // Reconnection check: Did this user belong to any active room?
    const existingRoomId = Object.keys(this.rooms).find(roomId =>
      this.rooms[roomId].players.some(p => p.id === user.id)
    );

    if (existingRoomId) {
      // Clear disconnect timeout
      if (this.disconnectTimeouts[user.id]) {
        clearTimeout(this.disconnectTimeouts[user.id]);
        delete this.disconnectTimeouts[user.id];
      }

      // Map client to room
      this.activeClients[client.id].roomId = existingRoomId;
      client.join(existingRoomId);

      client.emit('registered', user);
      client.emit('roomUpdated', this.rooms[existingRoomId]);
      
      this.server.to(existingRoomId).emit('chatMessage', {
        sender: 'System',
        text: `${user.username} has reconnected.`,
      });
    } else {
      client.emit('registered', user);
    }
  }

  @SubscribeMessage('joinRoom')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; username: string }
  ) {
    const { roomId, username } = data;
    const clientData = this.activeClients[client.id] || { userId: client.id, username };
    clientData.roomId = roomId;
    this.activeClients[client.id] = clientData;

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
      };
    }

    const room = this.rooms[roomId];

    // Avoid duplicate additions using stable userId
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

    this.server.to(roomId).emit('roomUpdated', room);
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

    // Minimum 3 players required for Thulla standard rule
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

    // Find the player holding Ace of Spades (starts the trick)
    const starterIdx = findAceOfSpadesPlayerIndex(room.players);
    room.currentTurn = starterIdx !== -1 ? starterIdx : 0;

    this.server.to(clientData.roomId).emit('roomUpdated', room);
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

  private executePlay(roomId: string, playerId: string, card: Card): TrickResult | null {
    const room = this.rooms[roomId];
    if (!room || room.status !== 'PLAYING') return null;

    const valResult = isValidPlay(room, playerId, card);
    if (!valResult.valid) return null;

    const trickRes = resolvePlay(room, playerId, card);
    this.server.to(roomId).emit('roomUpdated', room);

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
    try {
      const dbMatch = await this.prisma.match.create({
        data: {
          roomCode: room.roomId,
          status: 'COMPLETED',
        },
      });

      // Map connection IDs to usernames or user DB accounts (skip CPU bots)
      for (const p of room.players) {
        if (p.isBot) continue;

        const uRec = await this.prisma.user.findUnique({
          where: { username: p.username },
        });
        if (uRec) {
          const isWinner = room.winnerOrder[0] === p.id;
          const isLoser = room.loserId === p.id;
          
          let coinsChange = 10; // participation
          let xpEarned = 50;
          let rankChange = 5;

          if (isWinner) {
            coinsChange = 100;
            xpEarned = 250;
            rankChange = 25;
          } else if (isLoser) {
            coinsChange = -50;
            xpEarned = 10;
            rankChange = -15;
          }

          // Apply DB adjustments
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
            data: {
              matchId: dbMatch.id,
              userId: uRec.id,
              isWinner,
              xpEarned,
              coinsChange,
              rankChange,
            },
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
