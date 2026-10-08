import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuditLogService } from '../audit-log.service';
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import * as argon2 from 'argon2';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: any;
  let jwtService: any;
  let auditLog: any;

  const mockUsers: any[] = [];
  const mockRoles: any[] = [
    { id: 1, name: 'client' },
    { id: 2, name: 'admin' },
    { id: 3, name: 'affiliate' },
  ];
  const mockUserRoles: any[] = [];
  const mockRefreshTokens: any[] = [];
  const mockAuditLogs: any[] = [];

  beforeEach(async () => {
    mockUsers.length = 0;
    mockUserRoles.length = 0;
    mockRefreshTokens.length = 0;
    mockAuditLogs.length = 0;

    prisma = {
      user: {
        findUnique: jest.fn(async ({ where }) => {
          if (where.id) return mockUsers.find((u) => u.id === where.id) || null;
          if (where.email)
            return mockUsers.find((u) => u.email === where.email) || null;
          return null;
        }),
        create: jest.fn(async ({ data }) => {
          const user = { id: `user-${Date.now()}-${Math.random()}`, ...data };
          mockUsers.push(user);
          return user;
        }),
        update: jest.fn(async ({ where, data }) => {
          const user = mockUsers.find((u) => u.id === where.id);
          if (user) Object.assign(user, data);
          return user;
        }),
      },
      role: {
        findUnique: jest.fn(
          async ({ where }) =>
            mockRoles.find((r) => r.name === where.name) || null,
        ),
        create: jest.fn(async ({ data }) => {
          const r = { id: mockRoles.length + 1, ...data };
          mockRoles.push(r);
          return r;
        }),
      },
      userRole: {
        findMany: jest.fn(async ({ where }) => {
          return mockUserRoles
            .filter((ur) => ur.userId === where.userId)
            .map((ur) => ({
              ...ur,
              role: mockRoles.find((r) => r.id === ur.roleId),
            }));
        }),
        create: jest.fn(async ({ data }) => {
          mockUserRoles.push(data);
          return data;
        }),
        deleteMany: jest.fn(async ({ where }) => {
          const initial = mockUserRoles.length;
          const remaining = mockUserRoles.filter(
            (ur) => ur.userId !== where.userId,
          );
          mockUserRoles.length = 0;
          mockUserRoles.push(...remaining);
          return { count: initial - remaining.length };
        }),
      },
      refreshToken: {
        findMany: jest.fn(async ({ where }) => {
          return mockRefreshTokens.filter((rt) => {
            if (where?.revokedAt === null) return rt.revokedAt === null;
            if (where?.userId) return rt.userId === where.userId;
            return true;
          });
        }),
        create: jest.fn(async ({ data }) => {
          const rec = {
            id: mockRefreshTokens.length + 1,
            revokedAt: null,
            ...data,
          };
          mockRefreshTokens.push(rec);
          return rec;
        }),
        update: jest.fn(async ({ where, data }) => {
          const rec = mockRefreshTokens.find((r) => r.id === where.id);
          if (rec) Object.assign(rec, data);
          return rec;
        }),
        updateMany: jest.fn(async ({ where, data }) => {
          let count = 0;
          for (const rec of mockRefreshTokens) {
            if (where.userId && rec.userId === where.userId) {
              if (where.revokedAt === null && rec.revokedAt !== null) continue;
              Object.assign(rec, data);
              count++;
            }
          }
          return { count };
        }),
      },
      auditLog: {
        create: jest.fn(async ({ data }) => {
          mockAuditLogs.push(data);
          return data;
        }),
      },
    };

    jwtService = {
      sign: jest.fn(() => 'mock-jwt-token'),
    };

    auditLog = {
      log: jest.fn(async (entry) => {
        // Ensure no sensitive data in metadata
        const serialized = JSON.stringify(entry.metadata || {});
        if (/password|secret|cookie/i.test(serialized)) {
          throw new Error('Sensitive data in audit log metadata!');
        }
        return prisma.auditLog.create({ data: entry });
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: { get: () => 'test' } },
        { provide: AuditLogService, useValue: auditLog },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('Password Hashing with Argon2id', () => {
    it('should register a user with an Argon2id hash', async () => {
      const user = await service.register('test@example.com', 'StrongPass123!');
      expect(user.passwordHash).toMatch(/^\$argon2id\$/);
      expect(await argon2.verify(user.passwordHash, 'StrongPass123!')).toBe(
        true,
      );
    });

    it('should validate user credentials using Argon2id', async () => {
      await service.register('valid@example.com', 'StrongPass123!');
      const validated = await service.validateUser(
        'valid@example.com',
        'StrongPass123!',
      );
      expect(validated.email).toBe('valid@example.com');
    });

    it('should reject invalid credentials', async () => {
      await service.register('valid@example.com', 'StrongPass123!');
      await expect(
        service.validateUser('valid@example.com', 'WrongPass123!'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject an inactive user', async () => {
      const user = await service.register(
        'inactive@example.com',
        'StrongPass123!',
      );
      user.isActive = false;
      await expect(
        service.validateUser('inactive@example.com', 'StrongPass123!'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Password Change and Refresh Token Revocation', () => {
    it('should change password, reject old password, accept new password, and revoke previous tokens', async () => {
      const user = await service.register(
        'changer@example.com',
        'OldPassword123!',
      );
      const { refreshToken } = await service.login(user);

      // Verify token exists and is not revoked
      expect(mockRefreshTokens.length).toBe(1);
      expect(mockRefreshTokens[0].revokedAt).toBeNull();

      // Change password
      const result = await service.changePassword(
        user.id,
        'OldPassword123!',
        'NewPassword456!',
      );
      expect(result.message).toBe('Password changed successfully');

      // Old password should be rejected
      await expect(
        service.validateUser('changer@example.com', 'OldPassword123!'),
      ).rejects.toThrow(UnauthorizedException);

      // New password should be accepted
      const validated = await service.validateUser(
        'changer@example.com',
        'NewPassword456!',
      );
      expect(validated).toBeDefined();

      // Old refresh token must be revoked
      expect(mockRefreshTokens[0].revokedAt).not.toBeNull();

      // Attempting refresh with old token must be rejected
      await expect(service.refresh(refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );

      // Verify AuditLog registered USER_PASSWORD_CHANGE without exposing passwords
      const changeLog = mockAuditLogs.find(
        (l) => l.action === 'USER_PASSWORD_CHANGE',
      );
      expect(changeLog).toBeDefined();
      expect(changeLog.userId).toBe(user.id);
      expect(JSON.stringify(changeLog)).not.toContain('OldPassword123!');
      expect(JSON.stringify(changeLog)).not.toContain('NewPassword456!');
    });

    it('should reject password change with incorrect current password', async () => {
      const user = await service.register('user2@example.com', 'Password123!');
      await expect(
        service.changePassword(user.id, 'WrongCurrentPass!', 'NewPass789!'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('Refresh Token Rotation and Revocation', () => {
    it('should rotate refresh token and revoke the old one', async () => {
      const user = await service.register('rotator@example.com', 'Pass123!456');
      const { refreshToken: token1 } = await service.login(user);

      // Rotate token
      const { refreshToken: token2 } = await service.refresh(token1);
      expect(token2).toBeDefined();
      expect(token2).not.toBe(token1);

      // Old token must now be revoked
      expect(mockRefreshTokens[0].revokedAt).not.toBeNull();

      // Reusing old token must fail
      await expect(service.refresh(token1)).rejects.toThrow(
        UnauthorizedException,
      );

      // New token must succeed
      const { refreshToken: token3 } = await service.refresh(token2);
      expect(token3).toBeDefined();
    });

    it('should revoke refresh token on logout', async () => {
      const user = await service.register('logout@example.com', 'Pass123!456');
      const { refreshToken } = await service.login(user);

      expect(mockRefreshTokens[0].revokedAt).toBeNull();
      await service.logout(refreshToken);
      expect(mockRefreshTokens[0].revokedAt).not.toBeNull();

      // Refreshing revoked token must fail
      await expect(service.refresh(refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('Role Management and Audit', () => {
    it('should update roles and log USER_ROLES_UPDATED without exposing secrets', async () => {
      const user = await service.register('client@example.com', 'Pass123!456');
      await service.setRoles(user.id, ['affiliate', 'admin'], 'admin-actor-id');

      const roles = await service.getRoles(user.id);
      expect(roles).toContain('affiliate');
      expect(roles).toContain('admin');

      const roleLog = mockAuditLogs.find(
        (l) => l.action === 'USER_ROLES_UPDATED',
      );
      expect(roleLog).toBeDefined();
      expect(roleLog.userId).toBe('admin-actor-id');
      expect(roleLog.metadata.roles).toEqual(['affiliate', 'admin']);
    });
  });
});
