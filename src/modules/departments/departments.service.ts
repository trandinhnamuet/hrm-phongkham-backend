import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IsString, IsOptional, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Department } from '../../entities/department.entity';

export class CreateDepartmentDto {
  @ApiProperty() @IsString() @MinLength(2) name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
}

export class UpdateDepartmentDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() isActive?: boolean;
}

function toCode(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

@Injectable()
export class DepartmentsService {
  constructor(
    @InjectRepository(Department) private repo: Repository<Department>,
  ) {}

  findAll() {
    // Chi tra ve bo phan dang hoat dong: remove() la soft-delete (isActive=false),
    // neu khong loc thi bo phan da xoa van hien trong danh sach.
    return this.repo.find({ where: { isActive: true }, order: { name: 'ASC' } });
  }

  async create(dto: CreateDepartmentDto) {
    // remove() la soft-delete (isActive=false) nhung name/code unique o DB, nen neu
    // chi bao trung ten thi ten cua bo phan da xoa bi khoa vinh vien va nguoi dung
    // khong thay no o dau ca. Gap ban ghi da xoa thi kich hoat lai.
    const nameExists = await this.repo.findOne({ where: { name: dto.name } });
    if (nameExists) {
      if (nameExists.isActive) throw new ConflictException('Tên bộ phận đã tồn tại');
      Object.assign(nameExists, dto, { isActive: true });
      return this.repo.save(nameExists);
    }

    const baseCode = toCode(dto.name);
    let code = baseCode;
    let suffix = 2;
    while (await this.repo.findOne({ where: { code } })) {
      code = `${baseCode}_${suffix++}`;
    }

    return this.repo.save(this.repo.create({ ...dto, code }));
  }

  async update(id: number, dto: UpdateDepartmentDto) {
    const dept = await this.repo.findOne({ where: { id } });
    if (!dept) throw new NotFoundException('Không tìm thấy bộ phận');

    if (dto.name && dto.name !== dept.name) {
      const nameExists = await this.repo.findOne({ where: { name: dto.name } });
      if (nameExists) throw new ConflictException('Tên bộ phận đã tồn tại');

      const baseCode = toCode(dto.name);
      let code = baseCode;
      let suffix = 2;
      while (await this.repo.findOne({ where: { code } })) {
        code = `${baseCode}_${suffix++}`;
      }
      dept.code = code;
    }

    Object.assign(dept, { name: dto.name ?? dept.name, description: dto.description ?? dept.description, isActive: dto.isActive ?? dept.isActive });
    return this.repo.save(dept);
  }

  async remove(id: number) {
    const dept = await this.repo.findOne({ where: { id } });
    if (!dept) throw new NotFoundException('Không tìm thấy bộ phận');
    await this.repo.update(id, { isActive: false });
    return { message: 'Đã xóa bộ phận' };
  }
}
