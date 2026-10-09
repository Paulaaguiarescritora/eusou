import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { MediaService } from './media.service';
import { CreateMediaDto } from './dto/create-media.dto';
import { UpdateMediaDto } from './dto/update-media.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('products/:productId/media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post()
  create(
    @Param('productId') productId: string,
    @Body() dto: CreateMediaDto,
    @Req() req: any,
  ) {
    return this.mediaService.create(productId, dto, req.user?.sub);
  }

  @Post('upload')
  upload(
    @Param('productId') productId: string,
    @Body()
    body: { fileBase64: string; originalName?: string; isPrimary?: boolean },
    @Req() req: any,
  ) {
    return this.mediaService.uploadBase64(
      productId,
      body.fileBase64,
      body.originalName,
      body.isPrimary || false,
      req.user?.sub,
    );
  }

  @Get()
  findAll(@Param('productId') productId: string) {
    return this.mediaService.findAll(productId);
  }

  @Patch(':mediaId')
  update(
    @Param('productId') productId: string,
    @Param('mediaId') mediaId: string,
    @Body() dto: UpdateMediaDto,
    @Req() req: any,
  ) {
    return this.mediaService.update(productId, mediaId, dto, req.user?.sub);
  }

  @Delete(':mediaId')
  remove(
    @Param('productId') productId: string,
    @Param('mediaId') mediaId: string,
    @Req() req: any,
  ) {
    return this.mediaService.delete(productId, mediaId, req.user?.sub);
  }
}
