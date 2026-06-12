// backend/src/users/users.controller.ts
import { Controller, Get, Param, Post, Body } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Controller('api/users')
export class UsersController {
  constructor(private prisma: PrismaService) {}

  @Get('leaderboard')
  async getLeaderboard() {
    return this.prisma.user.findMany({
      orderBy: {
        rank: 'desc',
      },
      take: 100,
      select: {
        id: true,
        username: true,
        avatar: true,
        coins: true,
        xp: true,
        wins: true,
        losses: true,
        rank: true,
      },
    });
  }

  @Get(':username')
  async getUser(@Param('username') username: string) {
    return this.prisma.user.findUnique({
      where: { username },
      include: {
        matchHistory: {
          include: {
            match: true,
          },
          orderBy: {
            id: 'desc',
          },
          take: 10,
        },
      },
    });
  }
}
