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
import { TagService } from './tag.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { QueryTagsDto } from './dto/query-tags.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('tags')
export class TagController {
  constructor(private readonly tagService: TagService) {}

  @Post()
  create(@Body() dto: CreateTagDto, @Req() req: any) {
    return this.tagService.create(dto, req.user?.sub);
  }

  @Get()
  findAll(@Query() query: QueryTagsDto) {
    return this.tagService.findAll(query);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.tagService.findById(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTagDto, @Req() req: any) {
    return this.tagService.update(id, dto, req.user?.sub);
  }

  @Delete(':id')
  delete(@Param('id') id: string, @Req() req: any) {
    return this.tagService.delete(id, req.user?.sub);
  }
}
