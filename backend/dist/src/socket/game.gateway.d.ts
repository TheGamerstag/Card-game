import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma.service';
export declare class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private prisma;
    server: Server;
    private rooms;
    private activeClients;
    private disconnectTimeouts;
    constructor(prisma: PrismaService);
    handleConnection(client: Socket): void;
    handleDisconnect(client: Socket): void;
    private startDisconnectTimeout;
    private removeUserFromRoom;
    handleRegisterGuest(client: Socket, data: {
        username: string;
    }): Promise<void>;
    handleRequestTakeCards(client: Socket, data: {
        targetPlayerId: string;
    }): Promise<void>;
    handleRespondTakeCards(client: Socket, data: {
        targetPlayerId: string;
        accept: boolean;
    }): Promise<void>;
    handleJoinRoom(client: Socket, data: {
        roomId: string;
        username: string;
    }): void;
    handleLeaveRoom(client: Socket, roomId: string): void;
    handleToggleReady(client: Socket): void;
    handleStartBotGame(client: Socket, data: {
        totalPlayers: number;
    }): void;
    handleStartGame(client: Socket): void;
    handlePlayCard(client: Socket, card: any): Promise<void>;
    handleSendMessage(client: Socket, message: string): void;
    handleEmojiReaction(client: Socket, emoji: string): void;
    private executePlay;
    private processBotTurns;
    private persistGameResults;
}
