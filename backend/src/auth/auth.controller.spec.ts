import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { UnauthorizedException } from '@nestjs/common';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: any;
  let userService: any;

  beforeEach(async () => {
    authService = {
      register: jest
        .fn()
        .mockResolvedValue({ id: 'u1', email: 'user@test.com' }),
      validateUser: jest
        .fn()
        .mockResolvedValue({ id: 'u1', email: 'user@test.com' }),
      login: jest.fn().mockResolvedValue({
        accessToken: 'access-123',
        refreshToken: 'refresh-123',
      }),
      refresh: jest.fn().mockResolvedValue({
        accessToken: 'access-456',
        refreshToken: 'refresh-456',
      }),
      logout: jest.fn().mockResolvedValue(undefined),
      changePassword: jest
        .fn()
        .mockResolvedValue({ message: 'Password changed successfully' }),
      getRoles: jest.fn().mockResolvedValue(['client']),
      setRoles: jest.fn().mockResolvedValue({ message: 'Roles updated' }),
    };

    userService = {
      findById: jest.fn().mockResolvedValue({
        id: 'u1',
        email: 'user@test.com',
        isActive: true,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: UserService, useValue: userService },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should register a new user', async () => {
    const res = await controller.register({
      email: 'user@test.com',
      password: 'Password123!',
    });
    expect(res).toEqual({ id: 'u1', email: 'user@test.com' });
    expect(authService.register).toHaveBeenCalledWith(
      'user@test.com',
      'Password123!',
    );
  });

  it('should login user and set refresh token cookie', async () => {
    const mockRes: any = { cookie: jest.fn() };
    const res = await controller.login(
      { email: 'user@test.com', password: 'Password123!' },
      mockRes,
    );
    expect(res).toEqual({ accessToken: 'access-123' });
    expect(mockRes.cookie).toHaveBeenCalledWith(
      'refreshToken',
      'refresh-123',
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'strict',
        path: '/auth',
      }),
    );
  });

  it('should refresh token using cookie and set new rotated cookie', async () => {
    const mockReq: any = { cookies: { refreshToken: 'old-refresh-token' } };
    const mockRes: any = { cookie: jest.fn() };

    const res = await controller.refresh(mockReq, mockRes);
    expect(res).toEqual({ accessToken: 'access-456' });
    expect(authService.refresh).toHaveBeenCalledWith('old-refresh-token');
    expect(mockRes.cookie).toHaveBeenCalledWith(
      'refreshToken',
      'refresh-456',
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'strict',
        path: '/auth',
      }),
    );
  });

  it('should throw UnauthorizedException on refresh if cookie is missing', async () => {
    const mockReq: any = { cookies: {} };
    const mockRes: any = { cookie: jest.fn() };

    await expect(controller.refresh(mockReq, mockRes)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should logout and clear refresh cookie', async () => {
    const mockReq: any = { cookies: { refreshToken: 'token-to-revoke' } };
    const mockRes: any = { clearCookie: jest.fn() };

    await controller.logout(mockReq, mockRes);
    expect(authService.logout).toHaveBeenCalledWith('token-to-revoke');
    expect(mockRes.clearCookie).toHaveBeenCalledWith('refreshToken', {
      path: '/auth',
    });
  });

  it('should get current user profile with me()', async () => {
    const mockReq: any = { user: { sub: 'u1' } };
    const res = await controller.me(mockReq);
    expect(res).toEqual({
      id: 'u1',
      email: 'user@test.com',
      roles: ['client'],
    });
  });

  it('should change password on POST /auth/password and clear cookie', async () => {
    const mockReq: any = { user: { sub: 'u1' } };
    const mockRes: any = { clearCookie: jest.fn() };

    const res = await controller.changePassword(
      mockReq,
      { currentPassword: 'OldPass123!', newPassword: 'NewPass456!' },
      mockRes,
    );
    expect(res).toEqual({ message: 'Password updated successfully' });
    expect(authService.changePassword).toHaveBeenCalledWith(
      'u1',
      'OldPass123!',
      'NewPass456!',
    );
    expect(mockRes.clearCookie).toHaveBeenCalledWith('refreshToken', {
      path: '/auth',
    });
  });

  it('should update roles on admin endpoint', async () => {
    const mockReq: any = { user: { sub: 'admin-id' } };
    const res = await controller.updateRoles(mockReq, 'target-id', {
      roles: ['affiliate'],
    });
    expect(res).toEqual({ message: 'Roles updated' });
    expect(authService.setRoles).toHaveBeenCalledWith(
      'target-id',
      ['affiliate'],
      'admin-id',
    );
  });
});
