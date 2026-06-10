import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, UseGuards, ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import {
  DepartmentsService, CreateDepartmentDto, UpdateDepartmentDto,
} from './departments.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../entities/user.entity';

@ApiTags('Departments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('departments')
export class DepartmentsController {
  constructor(private service: DepartmentsService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.GIAM_DOC)
  create(@Body() dto: CreateDepartmentDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.GIAM_DOC)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDepartmentDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.GIAM_DOC)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
