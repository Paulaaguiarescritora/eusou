import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { ImportService } from './import.service';
import { DryRunDto, ExecuteImportDto } from './dto/dry-run.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/import')
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Post('dry-run')
  async dryRun(@Body() dto: DryRunDto, @Req() req: any) {
    if (!dto.fileBase64 || dto.fileBase64.trim().length === 0) {
      throw new BadRequestException('Arquivo não informado para validação.');
    }

    // Limpa header data URI se presente (ex: data:application/zip;base64,...)
    const cleanBase64 = dto.fileBase64.replace(/^data:.*?;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');

    return this.importService.dryRun(buffer, dto.fileName, req.user?.sub);
  }

  @Post('execute')
  async execute(@Body() dto: ExecuteImportDto, @Req() req: any) {
    return this.importService.execute(dto, req.user?.sub);
  }
}
