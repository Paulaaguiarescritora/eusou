import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { ForbiddenException, ExecutionContext } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import { UnauthorizedException } from '@nestjs/common';

describe('RBAC RolesGuard and JwtStrategy', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  const createMockContext = (
    roles: string[],
    userRoles?: string[],
  ): ExecutionContext => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(roles);

    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({
          user:
            userRoles !== undefined
              ? { id: 'u1', email: 'test@test.com', roles: userRoles }
              : null,
        }),
      }),
    } as unknown as ExecutionContext;
  };

  describe('RolesGuard', () => {
    it('should allow access if no roles are required', () => {
      const context = createMockContext([]);
      expect(guard.canActivate(context)).toBe(true);
    });

    it('should allow access to admin user on admin route', () => {
      const context = createMockContext(['admin'], ['admin']);
      expect(guard.canActivate(context)).toBe(true);
    });

    it('should forbid client user from accessing admin route', () => {
      const context = createMockContext(['admin'], ['client']);
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should forbid affiliate user from accessing admin route', () => {
      const context = createMockContext(['admin'], ['affiliate']);
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should forbid unauthenticated request from accessing role-protected route', () => {
      const context = createMockContext(['admin'], undefined);
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });
  });

  describe('JwtStrategy with inactive user check', () => {
    it('should reject inactive user', async () => {
      const mockPrisma: any = {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'u-inactive',
            email: 'in@test.com',
            isActive: false,
          }),
        },
      };
      const mockConfig: any = {
        get: jest.fn().mockReturnValue('secret'),
      };
      const strategy = new JwtStrategy(mockConfig, mockPrisma);

      await expect(
        strategy.validate({
          sub: 'u-inactive',
          email: 'in@test.com',
          roles: ['client'],
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should accept active user and return payload with roles', async () => {
      const mockPrisma: any = {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'u-active',
            email: 'act@test.com',
            isActive: true,
          }),
        },
      };
      const mockConfig: any = {
        get: jest.fn().mockReturnValue('secret'),
      };
      const strategy = new JwtStrategy(mockConfig, mockPrisma);

      const user = await strategy.validate({
        sub: 'u-active',
        email: 'act@test.com',
        roles: ['admin'],
      });
      expect(user).toEqual({
        sub: 'u-active',
        email: 'act@test.com',
        roles: ['admin'],
      });
    });
  });
});
