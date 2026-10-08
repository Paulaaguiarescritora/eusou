import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { ConfigService } from '@nestjs/config';
import { AuditLogService } from '../audit-log.service';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly auditLog: AuditLogService,
  ) {}

  async register(email: string, password: string, roleName: string = 'client') {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new BadRequestException('Email already registered');
    }

    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        isActive: true,
      },
    });

    // Ensure role exists and assign
    let role = await this.prisma.role.findUnique({ where: { name: roleName } });
    if (!role) {
      role = await this.prisma.role.create({ data: { name: roleName } });
    }

    await this.prisma.userRole.create({
      data: {
        userId: user.id,
        roleId: role.id,
      },
    });

    await this.auditLog.log({
      action: 'USER_REGISTER',
      entity: 'User',
      entityId: user.id,
      userId: user.id,
    });

    return user;
  }

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      await this.auditLog.log({
        action: 'USER_LOGIN_FAILED',
        entity: 'User',
        entityId: null,
        userId: null,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) {
      await this.auditLog.log({
        action: 'USER_LOGIN_FAILED',
        entity: 'User',
        entityId: user.id,
        userId: user.id,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new ForbiddenException('User is inactive');
    }

    await this.auditLog.log({
      action: 'USER_LOGIN',
      entity: 'User',
      entityId: user.id,
      userId: user.id,
    });

    return user;
  }

  async login(user: any) {
    const roles = await this.getRoles(user.id);
    const payload = { sub: user.id, email: user.email, roles };
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = await this.generateRefreshToken(user.id);
    return { accessToken, refreshToken };
  }

  async generateRefreshToken(userId: string) {
    const token = crypto.randomBytes(40).toString('hex');
    const tokenHash = await argon2.hash(token, { type: argon2.argon2id });
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days
    await this.prisma.refreshToken.create({
      data: { tokenHash, userId, expiresAt },
    });
    return token;
  }

  async refresh(oldRefreshToken: string) {
    const allTokens = await this.prisma.refreshToken.findMany({
      where: { revokedAt: null },
    });

    let validRecord = null;
    for (const rec of allTokens) {
      const match = await argon2.verify(rec.tokenHash, oldRefreshToken);
      if (match) {
        validRecord = rec;
        break;
      }
    }

    if (!validRecord) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (validRecord.expiresAt < new Date()) {
      await this.prisma.refreshToken.update({
        where: { id: validRecord.id },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Refresh token expired');
    }

    // Revoke old token (rotation)
    await this.prisma.refreshToken.update({
      where: { id: validRecord.id },
      data: { revokedAt: new Date() },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: validRecord.userId },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User is inactive or not found');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      roles: await this.getRoles(user.id),
    };
    const accessToken = this.jwtService.sign(payload);
    const newRefreshToken = await this.generateRefreshToken(user.id);

    await this.auditLog.log({
      action: 'REFRESH_TOKEN_ROTATED',
      entity: 'RefreshToken',
      entityId: validRecord.id.toString(),
      userId: user.id,
    });

    return { accessToken, refreshToken: newRefreshToken };
  }

  async logout(refreshToken: string) {
    const allTokens = await this.prisma.refreshToken.findMany({
      where: { revokedAt: null },
    });

    for (const rec of allTokens) {
      const match = await argon2.verify(rec.tokenHash, refreshToken);
      if (match) {
        await this.prisma.refreshToken.update({
          where: { id: rec.id },
          data: { revokedAt: new Date() },
        });

        await this.auditLog.log({
          action: 'REFRESH_TOKEN_REVOKED',
          entity: 'RefreshToken',
          entityId: rec.id.toString(),
          userId: rec.userId,
        });
        return;
      }
    }
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const valid = await argon2.verify(user.passwordHash, currentPassword);
    if (!valid) {
      await this.auditLog.log({
        action: 'USER_PASSWORD_CHANGE_FAILED',
        entity: 'User',
        entityId: user.id,
        userId: user.id,
      });
      throw new UnauthorizedException('Current password is incorrect');
    }

    const newHash = await argon2.hash(newPassword, { type: argon2.argon2id });
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    // Revoke all existing refresh tokens for this user
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.auditLog.log({
      action: 'USER_PASSWORD_CHANGE',
      entity: 'User',
      entityId: userId,
      userId: userId,
    });

    return { message: 'Password changed successfully' };
  }

  async getRoles(userId: string): Promise<string[]> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: true },
    });
    return userRoles.map((ur) => ur.role.name);
  }

  async setRoles(userId: string, roleNames: string[], actorId?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Delete existing roles
    await this.prisma.userRole.deleteMany({ where: { userId } });

    // Assign new roles
    for (const roleName of roleNames) {
      let role = await this.prisma.role.findUnique({
        where: { name: roleName },
      });
      if (!role) {
        role = await this.prisma.role.create({ data: { name: roleName } });
      }
      await this.prisma.userRole.create({
        data: {
          userId,
          roleId: role.id,
        },
      });
    }

    await this.auditLog.log({
      action: 'USER_ROLES_UPDATED',
      entity: 'User',
      entityId: userId,
      userId: actorId ?? null,
      metadata: { roles: roleNames },
    });

    return { message: 'Roles updated' };
  }
}
