import {
  Injectable, BadRequestException, NotFoundException, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  IsEnum, IsNumber, IsOptional, IsString, Min, Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AttendanceLog, AttendanceStatus } from '../../entities/attendance-log.entity';
import { AttendanceAdjustment, AdjustmentField, AdjustmentStatus } from '../../entities/attendance-adjustment.entity';
import { ClinicSettings } from '../../entities/clinic-settings.entity';
import { Shift } from '../../entities/shift.entity';
import { User, UserRole } from '../../entities/user.entity';
import { haversineDistance } from '../../common/utils/haversine';

export class CheckInDto {
  @ApiProperty() @IsNumber() @Min(-90) @Max(90) lat: number;
  @ApiProperty() @IsNumber() @Min(-180) @Max(180) lng: number;
}

export class CheckOutDto extends CheckInDto {}

export class CreateAdjustmentDto {
  @ApiProperty() logId: number;
  @ApiProperty({ enum: AdjustmentField }) @IsEnum(AdjustmentField) field: AdjustmentField;
  @ApiProperty() @IsString() requestedValue: string;
  @ApiProperty() @IsString() reason: string;
}

export class ReviewAdjustmentDto {
  @ApiProperty({ enum: ['APPROVED', 'REJECTED'] }) @IsEnum(['APPROVED', 'REJECTED']) status: 'APPROVED' | 'REJECTED';
  @ApiPropertyOptional() @IsOptional() @IsString() reviewNote?: string;
}

export class CreateShiftDto {
  @ApiProperty() @IsString() code: string;
  @ApiProperty() @IsString() name: string;
  @ApiProperty() @IsString() startTime: string;
  @ApiProperty() @IsString() endTime: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() breakMinutes?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() graceMinutes?: number;
}

@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(AttendanceLog) private logRepo: Repository<AttendanceLog>,
    @InjectRepository(AttendanceAdjustment) private adjRepo: Repository<AttendanceAdjustment>,
    @InjectRepository(ClinicSettings) private settingsRepo: Repository<ClinicSettings>,
    @InjectRepository(Shift) private shiftRepo: Repository<Shift>,
    @InjectRepository(User) private userRepo: Repository<User>,
  ) {}

  private async resolveManagerDeptIds(managerId: string): Promise<number[]> {
    const mgr = await this.userRepo.findOne({
      where: { id: managerId },
      relations: { managedDepartments: true },
    });
    const explicit = (mgr?.managedDepartments ?? []).map(d => Number(d.id));
    if (explicit.length > 0) return explicit;
    return mgr?.departmentId ? [Number(mgr.departmentId)] : [];
  }

  private toVnDateStr(date: Date): string {
    const vn = new Date(date.getTime() + 7 * 60 * 60 * 1000);
    return vn.toISOString().split('T')[0];
  }

  private vnMinutesFromMidnight(date: Date): number {
    const vn = new Date(date.getTime() + 7 * 60 * 60 * 1000);
    return vn.getUTCHours() * 60 + vn.getUTCMinutes();
  }

  async checkIn(user: User, dto: CheckInDto) {
    const now = new Date();
    const today = this.toVnDateStr(now);
    const existing = await this.logRepo.findOne({ where: { userId: user.id, workDate: today } });
    if (existing?.checkInAt) throw new BadRequestException('Bạn đã chấm công vào hôm nay');

    const { distance, valid } = await this.validateGps(dto.lat, dto.lng);

    if (!valid) {
      throw new BadRequestException(
        `Bạn đang ở ngoài phạm vi phòng khám (${Math.round(distance)}m). Vui lòng đến gần hơn để chấm công.`
      );
    }

    const shift = await this.getShiftForToday();
    let lateMinutes = 0;

    if (shift) {
      const [h, m] = shift.startTime.split(':').map(Number);
      const shiftStartMins = h * 60 + m + shift.graceMinutes;
      const nowMins = this.vnMinutesFromMidnight(now);
      lateMinutes = Math.max(0, nowMins - shiftStartMins);
    }

    if (existing) {
      existing.checkInAt = now;
      existing.checkInLat = dto.lat;
      existing.checkInLng = dto.lng;
      existing.checkInDistanceM = Math.round(distance);
      existing.checkInValid = valid;
      existing.lateMinutes = lateMinutes;
      existing.status = lateMinutes > 0 ? AttendanceStatus.LATE : AttendanceStatus.PRESENT;
      return this.logRepo.save(existing);
    }

    const log = this.logRepo.create({
      userId: user.id,
      workDate: today,
      shiftId: shift?.id,
      checkInAt: now,
      checkInLat: dto.lat,
      checkInLng: dto.lng,
      checkInDistanceM: Math.round(distance),
      checkInValid: valid,
      lateMinutes,
      status: lateMinutes > 0 ? AttendanceStatus.LATE : AttendanceStatus.PRESENT,
    });
    return this.logRepo.save(log);
  }

  async checkOut(user: User, dto: CheckOutDto) {
    const today = this.toVnDateStr(new Date());
    const log = await this.logRepo.findOne({
      where: { userId: user.id, workDate: today },
      relations: { shift: true },
    });
    if (!log) throw new BadRequestException('Bạn chưa chấm công vào hôm nay');
    if (log.checkOutAt) throw new BadRequestException('Bạn đã chấm công ra hôm nay');

    const { distance, valid } = await this.validateGps(dto.lat, dto.lng);

    if (!valid) {
      throw new BadRequestException(
        `Bạn đang ở ngoài phạm vi phòng khám (${Math.round(distance)}m).`
      );
    }

    const now = new Date();
    log.checkOutAt = now;
    log.checkOutLat = dto.lat;
    log.checkOutLng = dto.lng;
    log.checkOutDistanceM = Math.round(distance);
    log.checkOutValid = valid;

    if (log.checkInAt) {
      const workedMs = now.getTime() - log.checkInAt.getTime();
      const breakMs = (log.shift?.breakMinutes || 0) * 60000;
      log.workedMinutes = Math.max(0, Math.floor((workedMs - breakMs) / 60000));

      if (log.workedMinutes < 480) {
        log.status = AttendanceStatus.SHORT_HOURS;
      }
    }

    return this.logRepo.save(log);
  }

  async getMyLogs(userId: string, year: number, month: number) {
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const end = new Date(year, month, 0).toISOString().split('T')[0];
    return this.logRepo
      .createQueryBuilder('l')
      .leftJoinAndSelect('l.shift', 'shift')
      .where('l.userId = :uid', { uid: userId })
      .andWhere('l.work_date BETWEEN :start AND :end', { start, end })
      .orderBy('l.work_date', 'ASC')
      .getMany();
  }

  async getAllLogs(year: number, month: number, userId?: string, requestUser?: User) {
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const end = new Date(year, month, 0).toISOString().split('T')[0];
    const qb = this.logRepo
      .createQueryBuilder('l')
      .leftJoinAndSelect('l.user', 'user')
      .leftJoinAndSelect('l.shift', 'shift')
      .where('l.workDate BETWEEN :start AND :end', { start, end })
      .orderBy('l.workDate', 'DESC');
    if (userId) qb.andWhere('l.userId = :uid', { uid: userId });
    if (requestUser?.role === UserRole.QUAN_LY) {
      const deptIds = await this.resolveManagerDeptIds(requestUser.id);
      if (deptIds.length > 0) {
        qb.andWhere(
          `l.user_id IN (SELECT u.id FROM "HRM"."users" u WHERE u.department_id IN (:...deptIds))`,
          { deptIds },
        );
      } else {
        qb.andWhere('l.user_id = :managerId', { managerId: requestUser.id });
      }
    }
    return qb.getMany();
  }

  async getTodayStatus(userId: string) {
    const today = this.toVnDateStr(new Date());
    return this.logRepo.findOne({
      where: { userId, workDate: today },
      relations: { shift: true },
    });
  }

  async createAdjustment(dto: CreateAdjustmentDto, user: User) {
    if (user.role !== UserRole.GIAM_DOC) {
      throw new ForbiddenException('Chỉ Giám đốc mới được phép điều chỉnh chấm công');
    }
    const log = await this.logRepo.findOne({ where: { id: dto.logId } });
    if (!log) throw new NotFoundException('Không tìm thấy bản ghi chấm công');
    const adj = this.adjRepo.create({
      logId: dto.logId,
      requestedById: user.id,
      field: dto.field,
      requestedValue: dto.requestedValue,
      reason: dto.reason,
    });
    return this.adjRepo.save(adj);
  }

  async getPendingAdjustments() {
    return this.adjRepo.find({
      where: { status: AdjustmentStatus.PENDING },
      relations: { requestedBy: true, log: true },
      order: { createdAt: 'DESC' },
    });
  }

  async reviewAdjustment(id: number, dto: ReviewAdjustmentDto, reviewer: User) {
    const adj = await this.adjRepo.findOne({ where: { id }, relations: { log: true } });
    if (!adj) throw new NotFoundException('Không tìm thấy yêu cầu điều chỉnh');
    if (adj.status !== AdjustmentStatus.PENDING) {
      throw new BadRequestException('Yêu cầu này đã được xử lý');
    }

    adj.status = dto.status as AdjustmentStatus;
    adj.reviewedById = reviewer.id;
    adj.reviewedAt = new Date();
    adj.reviewNote = dto.reviewNote || null as unknown as string;

    if (dto.status === 'APPROVED') {
      const log = adj.log;
      if (adj.field === AdjustmentField.CHECK_IN) {
        log.checkInAt = new Date(adj.requestedValue);
      } else if (adj.field === AdjustmentField.CHECK_OUT) {
        log.checkOutAt = new Date(adj.requestedValue);
      } else if (adj.field === AdjustmentField.STATUS) {
        log.status = adj.requestedValue as AttendanceStatus;
      }
      log.isAdjusted = true;
      await this.logRepo.save(log);
    }

    await this.adjRepo.save(adj);
    return { message: dto.status === 'APPROVED' ? 'Đã duyệt điều chỉnh' : 'Đã từ chối điều chỉnh' };
  }

  async getShifts() {
    return this.shiftRepo.find({ where: { isActive: true } });
  }

  async createShift(dto: CreateShiftDto) {
    const shift = this.shiftRepo.create(dto);
    return this.shiftRepo.save(shift);
  }

  async getSettings() {
    return this.settingsRepo.findOne({ where: {} });
  }

  async updateSettings(data: Partial<ClinicSettings>) {
    let settings = await this.settingsRepo.findOne({ where: {} });
    if (!settings) {
      settings = this.settingsRepo.create(data);
    } else {
      Object.assign(settings, data);
    }
    return this.settingsRepo.save(settings);
  }

  private async validateGps(lat: number, lng: number) {
    const settings = await this.settingsRepo.findOne({ where: {} });
    if (!settings) return { distance: 0, valid: true };

    const distance = haversineDistance(lat, lng, +settings.gpsLat, +settings.gpsLng);
    return { distance, valid: distance <= settings.gpsRadiusM };
  }

  private async getShiftForToday() {
    const shifts = await this.shiftRepo.find({ where: { isActive: true } });
    return shifts.find((s) => s.code === 'FULL_DAY') || shifts[0] || null;
  }
}
