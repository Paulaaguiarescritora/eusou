import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>(
        'JWT_SECRET',
        'test-jwt-secret-key-do-not-use-in-production-12345',
      ),
    });
  }

  private static userCache = new Map<string, { id: string; email: string; isActive: boolean; expiresAt: number }>();

  async validate(payload: { sub: string; email: string; roles?: string[] }) {
    const now = Date.now();
    const cached = JwtStrategy.userCache.get(payload.sub);
    let user: { id: string; email: string; isActive: boolean } | null = null;

    if (cached && now < cached.expiresAt) {
      user = cached;
    } else {
      user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, email: true, isActive: true },
      });
      if (user) {
        JwtStrategy.userCache.set(payload.sub, {
          id: user.id,
          email: user.email,
          isActive: user.isActive,
          expiresAt: now + 3 * 60 * 1000, // 3 minutos de cache
        });
      }
    }

    if (!user || !user.isActive) {
      JwtStrategy.userCache.delete(payload.sub);
      throw new UnauthorizedException('User is inactive or not found');
    }

    return {
      sub: user.id,
      email: user.email,
      roles: payload.roles || [],
    };
  }
}
