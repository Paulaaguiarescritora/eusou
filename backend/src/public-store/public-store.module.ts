import { Module } from '@nestjs/common';
import { PublicStoreService } from './public-store.service';
import { PublicStoreController } from './public-store.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [PublicStoreController],
  providers: [PublicStoreService, PrismaService],
  exports: [PublicStoreService],
})
export class PublicStoreModule {}
