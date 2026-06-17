import { PrismaService } from '../prisma.service';
export declare class UsersController {
    private prisma;
    constructor(prisma: PrismaService);
    getLeaderboard(): Promise<{
        id: string;
        username: string;
        avatar: string | null;
        coins: number;
        xp: number;
        wins: number;
        losses: number;
        rank: number;
    }[]>;
    getUser(username: string): Promise<({
        matchHistory: ({
            match: {
                id: string;
                createdAt: Date;
                roomCode: string | null;
                status: string;
                duration: number;
            };
        } & {
            userId: string;
            id: string;
            isWinner: boolean;
            xpEarned: number;
            coinsChange: number;
            rankChange: number;
            matchId: string;
        })[];
    } & {
        id: string;
        username: string;
        avatar: string | null;
        coins: number;
        xp: number;
        wins: number;
        losses: number;
        rank: number;
        createdAt: Date;
        updatedAt: Date;
    }) | null>;
}
