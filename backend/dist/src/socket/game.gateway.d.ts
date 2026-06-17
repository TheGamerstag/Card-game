import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma.service';
export declare class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private prisma;
    server: Server;
    private rooms;
    private activeClients;
    private disconnectTimeouts;
    private turnTimers;
    constructor(prisma: PrismaService);
    handleConnection(client: Socket): void;
    handleDisconnect(client: Socket): void;
    private startDisconnectTimeout;
    private removeUserFromRoom;
    handleRegisterGuest(client: Socket, data: {
        username: string;
    }): Promise<void>;
    handleJoinRoom(client: Socket, data: {
        roomId: string;
        username: string;
    }): Promise<void>;
    handleLeaveRoom(client: Socket, roomId: string): void;
    handleToggleReady(client: Socket): void;
    handleRequestTakeCards(client: Socket, data: {
        targetPlayerId: string;
    }): void;
    private executeBotAcceptTakeCards;
    handleRespondTakeCards(client: Socket, data: {
        targetPlayerId: string;
        accept: boolean;
    }): void;
    handleRequestTradeCards(client: Socket, data: {
        targetPlayerId: string;
        offeredCardId: number;
        requestedCardId: number;
    }): void;
    handleRespondTradeCards(client: Socket, data: {
        targetPlayerId: string;
        accept: boolean;
    }): void;
    handlePlayAgainReady(client: Socket): void;
    private maybeStartNextMatch;
    handleStartBotGame(client: Socket, data: {
        totalPlayers: number;
    }): void;
    handleStartGame(client: Socket): void;
    handlePlayCard(client: Socket, card: any): Promise<void>;
    handleSendMessage(client: Socket, message: string): void;
    handleEmojiReaction(client: Socket, emoji: string): void;
    private startTurnTimer;
    private clearTurnTimer;
    private handleTurnTimeout;
    private executePlay;
    private processBotTurns;
    private persistGameResults;
}
