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
import { AttributeService } from './attribute.service';
import { CreateAttributeDto } from './dto/create-attribute.dto';
import { UpdateAttributeDto } from './dto/update-attribute.dto';
import { QueryAttributesDto } from './dto/query-attributes.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('attributes')
export class AttributeController {
  constructor(private readonly attributeService: AttributeService) {}

  @Post()
  create(@Body() dto: CreateAttributeDto, @Req() req: any) {
    return this.attributeService.create(dto, req.user?.sub);
  }

  @Get()
  findAll(@Query() query: QueryAttributesDto) {
    return this.attributeService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.attributeService.findById(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAttributeDto,
    @Req() req: any,
  ) {
    return this.attributeService.update(id, dto, req.user?.sub);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.attributeService.delete(id, req.user?.sub);
  }
}
