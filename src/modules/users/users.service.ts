import {
  Injectable, NotFoundException, ConflictException, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { User, UserRole, UserStatus } from '../../entities/user.entity';

export class CreateUserDto {
  @ApiProperty() @IsString() employeeCode: string;
  @ApiProperty() @IsString() fullName: string;
  @ApiProperty() @IsEmail() email: string;
  @ApiProperty() @IsString() @MinLength(6) password: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsEnum(UserRole) role?: UserRole;
  @ApiPropertyOptional() @IsOptional() @IsString() positionTitle?: string;
  @ApiPropertyOptional() @IsOptional() joinDate?: string;
  @ApiPropertyOptional() @IsOptional() departmentId?: number;
}

export class UpdateUserDto {
  @ApiPropertyOptional() @IsOptional() @IsString() fullName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsEnum(UserRole) role?: UserRole;
  @ApiPropertyOptional() @IsOptional() @IsString() positionTitle?: string;
  @ApiPropertyOptional() @IsOptional() @IsEnum(UserStatus) status?: UserStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() avatarUrl?: string;
  @ApiPropertyOptional() @IsOptional() departmentId?: number | null;
}

export class ChangePasswordDto {
  @ApiProperty() @IsString() @MinLength(6) newPassword: string;
}

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private repo: Repository<User>) {}

  async findAll(role?: UserRole, status?: UserStatus) {
    const qb = this.repo.createQueryBuilder('u')
      .leftJoinAndSelect('u.department', 'dept')
      .orderBy('u.fullName', 'ASC');
    if (role) qb.andWhere('u.role = :role', { role });
    if (status) qb.andWhere('u.status = :status', { status });
    const users = await qb.getMany();
    return users.map(this.sanitize);
  }

  async findOne(id: string) {
    const user = await this.repo.findOne({
      where: { id },
      relations: { department: true },
    });
    if (!user) throw new NotFoundException('Không tìm thấy nhân viên');
    return this.sanitize(user);
  }

  async create(dto: CreateUserDto) {
    const exists = await this.repo.findOne({ where: [{ email: dto.email }, { employeeCode: dto.employeeCode }] });
    if (exists) throw new ConflictException('Email hoặc mã NV đã tồn tại');

    const user = this.repo.create({
      employeeCode: dto.employeeCode,
      fullName: dto.fullName,
      email: dto.email,
      passwordHash: dto.password,
      phone: dto.phone,
      role: dto.role || UserRole.NHAN_VIEN,
      positionTitle: dto.positionTitle,
      joinDate: dto.joinDate ? new Date(dto.joinDate) : undefined,
      departmentId: dto.departmentId || undefined,
    });
    const saved = await this.repo.save(user);
    return this.sanitize(saved);
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.repo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Không tìm thấy nhân viên');
    Object.assign(user, dto);
    const saved = await this.repo.save(user);
    return this.sanitize(saved);
  }

  async changePassword(id: string, newPassword: string, requesterId: string, requesterRole: UserRole) {
    if (id !== requesterId && requesterRole !== UserRole.GIAM_DOC) {
      throw new ForbiddenException('Không có quyền đổi mật khẩu người khác');
    }
    const user = await this.repo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Không tìm thấy nhân viên');
    user.passwordHash = newPassword;
    await this.repo.save(user);
    return { message: 'Đổi mật khẩu thành công' };
  }

  private sanitize(user: User) {
    const { passwordHash, ...rest } = user as any;
    return rest;
  }
}
