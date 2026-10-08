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
import { NicheService } from './niche.service';
import { CreateNicheDto } from './dto/create-niche.dto';
import { UpdateNicheDto } from './dto/update-niche.dto';
import { QueryNichesDto } from './dto/query-niches.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('niches')
export class NicheController {
  constructor(private readonly nicheService: NicheService) {}

  @Post()
  create(@Body() dto: CreateNicheDto, @Req() req: any) {
    return this.nicheService.create(dto, req.user?.sub);
  }

  @Get()
  findAll(@Query() query: QueryNichesDto) {
    return this.nicheService.findAll(query);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.nicheService.findById(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateNicheDto,
    @Req() req: any,
  ) {
    return this.nicheService.update(id, dto, req.user?.sub);
  }

  @Delete(':id')
  delete(@Param('id') id: string, @Req() req: any) {
    return this.nicheService.delete(id, req.user?.sub);
  }
}
