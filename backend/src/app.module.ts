import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller';
import { InfoController } from './info.controller';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { ProductModule } from './product/product.module';
import { AttributeModule } from './attribute/attribute.module';
import { ProductAttributeModule } from './product-attribute/product-attribute.module';
import { VariantModule } from './variant/variant.module';
import { MediaModule } from './media/media.module';
import { PrismaService } from './prisma.service';
import { AuditLogService } from './audit-log.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    UserModule,
    ProductModule,
    AttributeModule,
    ProductAttributeModule,
    VariantModule,
    MediaModule,
  ],
  controllers: [HealthController, InfoController],
  providers: [PrismaService, AuditLogService],
})
export class AppModule {}
