import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './jwt.strategy';
import { RolesGuard } from './roles.guard';
import { PassportModule } from '@nestjs/passport';
import { PrismaService } from '../prisma.service';
import { UserService } from '../user/user.service';
import { AuditLogService } from '../audit-log.service';

@Module({
  imports: [
    ConfigModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>(
          'JWT_SECRET',
          'test-jwt-secret-key-do-not-use-in-production-12345',
        ),
        signOptions: { expiresIn: configService.get<string>('JWT_EXPIRES_IN', '7d') },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    AuthService,
    JwtStrategy,
    RolesGuard,
    PrismaService,
    UserService,
    AuditLogService,
  ],
  controllers: [AuthController],
  exports: [AuthService, RolesGuard],
})
export class AuthModule {}
