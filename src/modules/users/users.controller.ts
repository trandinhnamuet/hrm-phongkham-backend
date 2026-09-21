import {
  Controller, Get, Post, Patch, Put, Body, Param, Query, UseGuards, ForbiddenException,
  ParseUUIDPipe, ParseEnumPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import {
  UsersService, CreateUserDto, UpdateUserDto, ChangePasswordDto,
  SetManagedDepartmentsDto,
} from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User, UserRole, UserStatus } from '../../entities/user.entity';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @Roles(UserRole.GIAM_DOC, UserRole.QUAN_LY)
  @ApiQuery({ name: 'role', required: false, enum: UserRole })
  @ApiQuery({ name: 'status', required: false, enum: UserStatus })
  findAll(
    @Query('role', new ParseEnumPipe(UserRole, { optional: true })) role?: UserRole,
    @Query('status', new ParseEnumPipe(UserStatus, { optional: true })) status?: UserStatus,
  ) {
    return this.usersService.findAll(role, status);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() me: User) {
    if (me.role === UserRole.NHAN_VIEN && me.id !== id) {
      throw new ForbiddenException('Không có quyền');
    }
    return this.usersService.findOne(id);
  }

  @Get(':id/managed-departments')
  @Roles(UserRole.GIAM_DOC, UserRole.QUAN_LY)
  getManagedDepartments(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() me: User) {
    if (me.role === UserRole.QUAN_LY && me.id !== id) {
      throw new ForbiddenException('Chỉ có thể xem bộ phận của chính mình');
    }
    return this.usersService.getManagedDepartments(id);
  }

  @Put(':id/managed-departments')
  @Roles(UserRole.GIAM_DOC)
  setManagedDepartments(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SetManagedDepartmentsDto,
  ) {
    return this.usersService.setManagedDepartments(id, body.departmentIds ?? []);
  }

  @Post()
  @Roles(UserRole.GIAM_DOC)
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto, @CurrentUser() me: User) {
    const isDirector = me.role === UserRole.GIAM_DOC;

    // Chi Giam doc duoc sua ho so nguoi khac.
    if (!isDirector && me.id !== id) {
      throw new ForbiddenException('Không có quyền');
    }

    // Chi Giam doc duoc thay doi cac field ve quyen han / to chuc.
    // Truoc day bat ky ai cung co the PATCH chinh minh voi { role: 'GIAM_DOC' } de
    // tu nang len Giam doc (jwt.strategy doc role tu DB nen co hieu luc ngay lap tuc).
    if (!isDirector) {
      const privileged = ['role', 'status', 'departmentId', 'shiftId', 'managedDepartmentIds'] as const;
      const touched = privileged.filter((f) => dto[f] !== undefined);
      if (touched.length > 0) {
        throw new ForbiddenException('Không có quyền thay đổi: ' + touched.join(', '));
      }
    }

    return this.usersService.update(id, dto);
  }

  @Patch(':id/password')
  changePassword(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ChangePasswordDto, @CurrentUser() me: User) {
    return this.usersService.changePassword(id, dto.newPassword, me.id, me.role);
  }
}
