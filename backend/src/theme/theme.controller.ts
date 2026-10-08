import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ThemeService } from './theme.service';
import { CreateThemeDto } from './dto/create-theme.dto';
import { UpdateThemeDto } from './dto/update-theme.dto';
import { QueryThemesDto } from './dto/query-themes.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('themes')
export class ThemeController {
  constructor(private readonly themeService: ThemeService) {}

  @Post()
  create(@Body() dto: CreateThemeDto, @Req() req: any) {
    return this.themeService.create(dto, req.user?.sub);
  }

  @Post(':id/duplicate')
  duplicate(@Param('id') id: string, @Req() req: any) {
    return this.themeService.duplicate(id, req.user?.sub);
  }

  @Get()
  findAll(@Query() query: QueryThemesDto) {
    return this.themeService.findAll(query);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.themeService.findById(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateThemeDto,
    @Req() req: any,
  ) {
    return this.themeService.update(id, dto, req.user?.sub);
  }

  @Delete(':id')
  delete(@Param('id') id: string, @Req() req: any) {
    return this.themeService.delete(id, req.user?.sub);
  }
}
