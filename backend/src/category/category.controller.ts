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
import { CategoryService } from './category.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { QueryCategoriesDto } from './dto/query-categories.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Post()
  create(@Body() dto: CreateCategoryDto, @Req() req: any) {
    return this.categoryService.create(dto, req.user?.sub);
  }

  @Get()
  findAll(@Query() query: QueryCategoriesDto) {
    return this.categoryService.findAll(query);
  }

  @Get('tree')
  getTree() {
    return this.categoryService.getTree();
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.categoryService.findById(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
    @Req() req: any,
  ) {
    return this.categoryService.update(id, dto, req.user?.sub);
  }

  @Delete(':id')
  delete(@Param('id') id: string, @Req() req: any) {
    return this.categoryService.delete(id, req.user?.sub);
  }
}
