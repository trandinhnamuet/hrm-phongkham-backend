import {
  Injectable, BadRequestException, NotFoundException, ForbiddenException, ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull } from 'typeorm';
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LeaveRequest, LeaveRequestStatus } from '../../entities/leave-request.entity';
import { LeaveBalance } from '../../entities/leave-balance.entity';
import { LeaveType } from '../../entities/leave-type.entity';
import { User, UserRole } from '../../entities/user.entity';

export class CreateLeaveTypeDto {
  @ApiProperty() @IsString() name: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() maxDays?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() deductsBalance?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() requiresDoc?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isPaid?: boolean;
}

export class UpdateLeaveTypeDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() maxDays?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() deductsBalance?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() requiresDoc?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isPaid?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class CreateLeaveRequestDto {
  @ApiProperty() @IsNumber() leaveTypeId: number;
  @ApiProperty() @IsDateString() startDate: string;
  @ApiProperty() @IsDateString() endDate: string;
  @ApiProperty() @IsString() reason: string;
  @ApiPropertyOptional() @IsOptional() @IsString() attachmentUrl?: string;
}

export class ReviewLeaveDto {
  @ApiProperty({ enum: ['APPROVED', 'REJECTED'] }) @IsEnum(['APPROVED', 'REJECTED']) status: 'APPROVED' | 'REJECTED';
  @ApiPropertyOptional() @IsOptional() @IsString() reviewNote?: string;
}

@Injectable()
export class LeaveService {
  constructor(
    @InjectRepository(LeaveRequest) private requestRepo: Repository<LeaveRequest>,
    @InjectRepository(LeaveBalance) private balanceRepo: Repository<LeaveBalance>,
    @InjectRepository(LeaveType) private typeRepo: Repository<LeaveType>,
    private dataSource: DataSource,
  ) {}

  async getLeaveTypes() {
    return this.typeRepo.find({ where: { isActive: true }, order: { name: 'ASC' } });
  }

  private toCode(name: string): string {
    return name
      .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd')
      .toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
  }

  async createLeaveType(dto: CreateLeaveTypeDto) {
    const base = this.toCode(dto.name);
    let code = base; let n = 2;
    while (await this.typeRepo.findOne({ where: { code } })) code = `${base}_${n++}`;
    if (await this.typeRepo.findOne({ where: { name: dto.name } }))
      throw new ConflictException('Tên loại nghỉ đã tồn tại');
    return this.typeRepo.save(this.typeRepo.create({
      ...dto, code,
      deductsBalance: dto.deductsBalance ?? true,
      requiresDoc: dto.requiresDoc ?? false,
      isPaid: dto.isPaid ?? true,
    }));
  }

  async updateLeaveType(id: number, dto: UpdateLeaveTypeDto) {
    const lt = await this.typeRepo.findOne({ where: { id } });
    if (!lt) throw new NotFoundException('Không tìm thấy loại nghỉ');
    Object.assign(lt, dto);
    return this.typeRepo.save(lt);
  }

  async deleteLeaveType(id: number) {
    const lt = await this.typeRepo.findOne({ where: { id } });
    if (!lt) throw new NotFoundException('Không tìm thấy loại nghỉ');
    await this.typeRepo.update(id, { isActive: false });
    return { message: 'Đã xóa loại nghỉ' };
  }

  async getMyBalance(userId: string) {
    const now = new Date();
    return this.balanceRepo.find({
      where: { userId, year: now.getFullYear(), month: now.getMonth() + 1 },
    });
  }

  async getBalance(userId: string, year?: number, month?: number) {
    const now = new Date();
    return this.balanceRepo.find({
      where: {
        userId,
        year: year || now.getFullYear(),
        month: month || now.getMonth() + 1,
      },
    });
  }

  async createRequest(dto: CreateLeaveRequestDto, user: User) {
    const leaveType = await this.typeRepo.findOne({ where: { id: dto.leaveTypeId, isActive: true } });
    if (!leaveType) throw new NotFoundException('Loại nghỉ tuần không tồn tại');

    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    if (end < start) throw new BadRequestException('Ngày kết thúc phải sau ngày bắt đầu');

    const totalDays = this.calcWorkingDays(start, end);
    if (totalDays <= 0) throw new BadRequestException('Số ngày nghỉ phải lớn hơn 0');

    if (leaveType.maxDays && totalDays > leaveType.maxDays) {
      throw new BadRequestException(`Loại phép này tối đa ${leaveType.maxDays} ngày`);
    }

    // Tự động duyệt nếu nghỉ 1 ngày trong tuần (Thứ 2–6)
    const startDay = start.getDay(); // 0=CN, 1=T2, ..., 5=T6, 6=T7
    const autoApprove = totalDays === 1 && startDay >= 1 && startDay <= 5;

    return this.dataSource.transaction(async (manager) => {
      if (leaveType.deductsBalance) {
        const now = new Date();
        const balance = await manager.findOne(LeaveBalance, {
          where: { userId: user.id, year: now.getFullYear(), month: now.getMonth() + 1 },
          lock: { mode: 'pessimistic_write' },
        });

        if (!balance) {
          const newBalance = manager.create(LeaveBalance, {
            userId: user.id,
            year: now.getFullYear(),
            month: now.getMonth() + 1,
            entitledDays: 4,
            usedDays: autoApprove ? totalDays : 0,
            pendingDays: autoApprove ? 0 : totalDays,
          });
          await manager.save(LeaveBalance, newBalance);
        } else {
          const available = +balance.entitledDays - +balance.usedDays - +balance.pendingDays;
          if (available < totalDays) {
            throw new BadRequestException(
              `Không đủ ngày nghỉ tuần. Còn lại: ${available.toFixed(1)} ngày`
            );
          }
          if (autoApprove) {
            balance.usedDays = +balance.usedDays + totalDays;
          } else {
            balance.pendingDays = +balance.pendingDays + totalDays;
          }
          await manager.save(LeaveBalance, balance);
        }
      }

      const request = manager.create(LeaveRequest, {
        userId: user.id,
        leaveTypeId: dto.leaveTypeId,
        startDate: dto.startDate,
        endDate: dto.endDate,
        totalDays,
        reason: dto.reason,
        attachmentUrl: dto.attachmentUrl,
        status: autoApprove ? LeaveRequestStatus.APPROVED : LeaveRequestStatus.PENDING,
        reviewedById: autoApprove ? user.id : null as unknown as string,
        reviewedAt: autoApprove ? new Date() : null as unknown as Date,
        reviewNote: autoApprove ? 'Tự động duyệt (nghỉ ngày thường)' : null as unknown as string,
      });
      return manager.save(LeaveRequest, request);
    });
  }

  async getMyRequests(userId: string) {
    return this.requestRepo.find({
      where: { userId, deletedAt: IsNull() as any },
      relations: { leaveType: true, reviewedBy: true },
      order: { createdAt: 'DESC' },
    });
  }

  async getAllRequests(status?: LeaveRequestStatus) {
    const where: any = { deletedAt: IsNull() as any };
    if (status) where.status = status;
    return this.requestRepo.find({
      where,
      relations: { user: true, leaveType: true, reviewedBy: true },
      order: { createdAt: 'DESC' },
    });
  }

  async reviewRequest(id: number, dto: ReviewLeaveDto, reviewer: User) {
    const request = await this.requestRepo.findOne({
      where: { id, deletedAt: IsNull() as any },
      relations: { leaveType: true },
    });
    if (!request) throw new NotFoundException('Không tìm thấy đơn nghỉ phép');
    if (request.status !== LeaveRequestStatus.PENDING) {
      throw new BadRequestException('Đơn này đã được xử lý');
    }

    return this.dataSource.transaction(async (manager) => {
      request.status = dto.status as LeaveRequestStatus;
      request.reviewedById = reviewer.id;
      request.reviewedAt = new Date();
      request.reviewNote = dto.reviewNote || null as unknown as string;

      if (request.leaveType.deductsBalance) {
        const now = new Date();
        const balance = await manager.findOne(LeaveBalance, {
          where: { userId: request.userId, year: now.getFullYear(), month: now.getMonth() + 1 },
          lock: { mode: 'pessimistic_write' },
        });

        if (balance) {
          balance.pendingDays = Math.max(0, +balance.pendingDays - +request.totalDays);
          if (dto.status === 'APPROVED') {
            balance.usedDays = +balance.usedDays + +request.totalDays;
          }
          await manager.save(LeaveBalance, balance);
        }
      }

      return manager.save(LeaveRequest, request);
    });
  }

  async cancelRequest(id: number, user: User) {
    const request = await this.requestRepo.findOne({
      where: { id, deletedAt: IsNull() as any },
      relations: { leaveType: true },
    });
    if (!request) throw new NotFoundException('Không tìm thấy đơn nghỉ phép');
    if (request.userId !== user.id) throw new ForbiddenException('Không có quyền hủy đơn này');
    if (request.status === LeaveRequestStatus.APPROVED) {
      throw new BadRequestException('Đơn đã được duyệt, không thể hủy');
    }

    return this.dataSource.transaction(async (manager) => {
      if (request.leaveType.deductsBalance && request.status === LeaveRequestStatus.PENDING) {
        const now = new Date();
        const balance = await manager.findOne(LeaveBalance, {
          where: { userId: user.id, year: now.getFullYear(), month: now.getMonth() + 1 },
          lock: { mode: 'pessimistic_write' },
        });
        if (balance) {
          balance.pendingDays = Math.max(0, +balance.pendingDays - +request.totalDays);
          await manager.save(LeaveBalance, balance);
        }
      }
      request.status = LeaveRequestStatus.CANCELLED;
      request.deletedAt = new Date();
      return manager.save(LeaveRequest, request);
    });
  }

  async initMonthlyBalance(userId: string, year: number, month: number) {
    const exists = await this.balanceRepo.findOne({ where: { userId, year, month } });
    if (exists) return exists;
    const balance = this.balanceRepo.create({ userId, year, month, entitledDays: 4 });
    return this.balanceRepo.save(balance);
  }

  private calcWorkingDays(start: Date, end: Date): number {
    let count = 0;
    const current = new Date(start);
    while (current <= end) {
      count++;
      current.setDate(current.getDate() + 1);
    }
    return count;
  }
}
