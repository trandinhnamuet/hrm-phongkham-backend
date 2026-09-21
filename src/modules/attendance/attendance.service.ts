import {
  Injectable, BadRequestException, NotFoundException, ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  IsBoolean, IsDateString, IsEnum, IsIn, IsNumber, IsOptional, IsString, Min, Max,
} from 'class-validator';
import { Type } from 'class-transformer';
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
  @ApiProperty() @Type(() => Number) @IsNumber() logId: number;
  @ApiProperty({ enum: AdjustmentField }) @IsEnum(AdjustmentField) field: AdjustmentField;
  @ApiProperty() @IsString() requestedValue: string;
  @ApiProperty() @IsString() reason: string;
}

export class ReviewAdjustmentDto {
  @ApiProperty({ enum: ['APPROVED', 'REJECTED'] }) @IsIn(['APPROVED', 'REJECTED']) status: 'APPROVED' | 'REJECTED';
  @ApiPropertyOptional() @IsOptional() @IsString() reviewNote?: string;
}

export class CreateShiftDto {
  @ApiProperty() @IsString() code: string;
  @ApiProperty() @IsString() name: string;
  @ApiPropertyOptional({ description: "Giờ vào buổi sáng, 'HH:mm'" })
  @IsOptional() @IsString() morningStart?: string | null;
  @ApiPropertyOptional({ description: "Giờ tan buổi sáng, 'HH:mm'" })
  @IsOptional() @IsString() morningEnd?: string | null;
  @ApiPropertyOptional({ description: "Giờ vào buổi chiều, 'HH:mm'" })
  @IsOptional() @IsString() afternoonStart?: string | null;
  @ApiPropertyOptional({ description: "Giờ tan buổi chiều, 'HH:mm'" })
  @IsOptional() @IsString() afternoonEnd?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsNumber() graceMinutes?: number;
}

export class UpdateLogDto {
  /** Giờ vào dạng ISO. null nghĩa là xoá giờ vào. */
  @ApiPropertyOptional() @IsOptional() @IsDateString() checkInAt?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsDateString() checkOutAt?: string | null;
  @ApiPropertyOptional({ enum: AttendanceStatus })
  @IsOptional() @IsEnum(AttendanceStatus) status?: AttendanceStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
}

export class UpdateShiftDto {
  @ApiPropertyOptional() @IsOptional() @IsString() code?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() morningStart?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() morningEnd?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() afternoonStart?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() afternoonEnd?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsNumber() graceMinutes?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

/** Bốn mốc giờ của một ca — dùng chung cho DTO và bản ghi đã lưu. */
interface ShiftTimesInput {
  morningStart?: string | null;
  morningEnd?: string | null;
  afternoonStart?: string | null;
  afternoonEnd?: string | null;
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

  /** 'HH:mm' hoặc 'HH:mm:ss' -> số phút tính từ 0h. */
  private timeToMinutes(time?: string | null): number | null {
    if (!time) return null;
    const [h, m] = time.split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
  }

  /** Các khoảng giờ làm việc của ca (sáng, chiều) dưới dạng [từ, đến] phút. */
  private shiftSessions(shift?: Shift | null): Array<[number, number]> {
    if (!shift) return [];
    const sessions: Array<[number, number]> = [];
    const pairs: Array<[string | null, string | null]> = [
      [shift.morningStart, shift.morningEnd],
      [shift.afternoonStart, shift.afternoonEnd],
    ];
    for (const [from, to] of pairs) {
      const a = this.timeToMinutes(from);
      const b = this.timeToMinutes(to);
      if (a !== null && b !== null && b > a) sessions.push([a, b]);
    }
    return sessions.sort((x, y) => x[0] - y[0]);
  }

  /**
   * Số phút NẰM TRONG giờ làm của ca, giữa hai mốc `from`..`to`.
   * Khoảng nghỉ trưa là chỗ trống giữa hai buổi nên tự động không được tính.
   */
  private scheduledMinutesBetween(
    sessions: Array<[number, number]>,
    from: number,
    to: number,
  ): number {
    if (to <= from) return 0;
    return sessions.reduce(
      (sum, [a, b]) => sum + Math.max(0, Math.min(b, to) - Math.max(a, from)),
      0,
    );
  }

  /**
   * Tính công một ngày theo giờ làm việc của ca.
   *
   * Đi muộn và về sớm được quy ra "số phút làm việc theo ca bị thiếu", nên một
   * người đến lúc 14:05 của ca 7:00-11:30/14:00-17:30 bị tính muộn 275 phút
   * (cả buổi sáng + 5 phút) chứ không phải 425 phút — 2 tiếng rưỡi nghỉ trưa
   * không phải giờ làm nên không bị tính vào.
   *
   * Trả về null nếu ngày đó không gắn với ca nào.
   */
  private computeAgainstShift(
    shift: Shift | null | undefined,
    checkInMins: number,
    checkOutMins: number | null,
  ) {
    const sessions = this.shiftSessions(shift);
    if (sessions.length === 0) return null;

    const dayStart = sessions[0][0];
    const dayEnd = sessions[sessions.length - 1][1];
    const grace = shift?.graceMinutes ?? 0;

    // Đến sớm hoặc trong khoảng gia hạn đều tính từ giờ bắt đầu ca.
    const effectiveIn = checkInMins <= dayStart + grace ? dayStart : checkInMins;
    const expectedMinutes = this.scheduledMinutesBetween(sessions, dayStart, dayEnd);
    const lateMinutes = this.scheduledMinutesBetween(sessions, dayStart, effectiveIn);

    if (checkOutMins === null) {
      return { expectedMinutes, lateMinutes, earlyLeaveMinutes: 0, workedMinutes: 0 };
    }

    // Chấm ra sau nửa đêm thì phút-từ-0h nhỏ hơn giờ vào -> coi như làm hết ca.
    const effectiveOut = checkOutMins < effectiveIn ? dayEnd : checkOutMins;
    const workedMinutes = this.scheduledMinutesBetween(sessions, effectiveIn, effectiveOut);
    const earlyLeaveMinutes = this.scheduledMinutesBetween(sessions, effectiveOut, dayEnd);

    return { expectedMinutes, lateMinutes, earlyLeaveMinutes, workedMinutes };
  }

  /** Trạng thái suy ra từ kết quả tính công theo ca. */
  private statusFromCalc(calc: { lateMinutes: number; earlyLeaveMinutes: number }) {
    if (calc.earlyLeaveMinutes > 0) return AttendanceStatus.SHORT_HOURS;
    if (calc.lateMinutes > 0) return AttendanceStatus.LATE;
    return AttendanceStatus.PRESENT;
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

    const shift = await this.getShiftForUser(user);
    const calc = this.computeAgainstShift(shift, this.vnMinutesFromMidnight(now), null);
    const lateMinutes = calc?.lateMinutes ?? 0;
    const expectedMinutes = calc?.expectedMinutes ?? 0;
    const status = lateMinutes > 0 ? AttendanceStatus.LATE : AttendanceStatus.PRESENT;

    if (existing) {
      existing.shiftId = shift?.id ?? existing.shiftId;
      existing.checkInAt = now;
      existing.checkInLat = dto.lat;
      existing.checkInLng = dto.lng;
      existing.checkInDistanceM = Math.round(distance);
      existing.checkInValid = valid;
      existing.lateMinutes = lateMinutes;
      existing.expectedMinutes = expectedMinutes;
      existing.status = status;
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
      expectedMinutes,
      status,
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
      const calc = this.computeAgainstShift(
        log.shift,
        this.vnMinutesFromMidnight(log.checkInAt),
        this.vnMinutesFromMidnight(now),
      );

      if (calc) {
        log.expectedMinutes = calc.expectedMinutes;
        log.lateMinutes = calc.lateMinutes;
        log.earlyLeaveMinutes = calc.earlyLeaveMinutes;
        log.workedMinutes = calc.workedMinutes;
        log.status = this.statusFromCalc(calc);
      } else {
        // Ngày đó không gắn ca nào -> đếm theo thời gian có mặt thực tế.
        log.workedMinutes = Math.max(0, Math.floor((now.getTime() - log.checkInAt.getTime()) / 60000));
      }
    }

    return this.logRepo.save(log);
  }

  // year/month den tu query. Neu khong chan bien thi
  // new Date(year, month, 0).toISOString() nem RangeError -> 500 Internal server error.
  private monthRange(year: number, month: number) {
    if (!Number.isInteger(year) || year < 2000 || year > 2100
      || !Number.isInteger(month) || month < 1 || month > 12) {
      throw new BadRequestException('year phải trong 2000-2100 và month trong 1-12');
    }
    return {
      start: `${year}-${String(month).padStart(2, '0')}-01`,
      end: new Date(year, month, 0).toISOString().split('T')[0],
    };
  }

  async getMyLogs(userId: string, year: number, month: number) {
    const { start, end } = this.monthRange(year, month);
    return this.logRepo
      .createQueryBuilder('l')
      .leftJoinAndSelect('l.shift', 'shift')
      .where('l.userId = :uid', { uid: userId })
      .andWhere('l.work_date BETWEEN :start AND :end', { start, end })
      .orderBy('l.work_date', 'ASC')
      .getMany();
  }

  async getAllLogs(year: number, month: number, userId?: string, requestUser?: User) {
    const { start, end } = this.monthRange(year, month);
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

  /**
   * Giám đốc sửa thẳng một bản ghi chấm công.
   *
   * Đi muộn và số phút làm được tính lại từ giờ mới, không giữ giá trị cũ —
   * nếu không, sửa giờ vào xong mà cột "đi muộn" vẫn là số của giờ cũ thì bảng
   * công mâu thuẫn với chính nó.
   */
  async updateLog(id: number, dto: UpdateLogDto) {
    const log = await this.logRepo.findOne({ where: { id }, relations: { shift: true } });
    if (!log) throw new NotFoundException('Không tìm thấy bản ghi chấm công');

    if (dto.checkInAt !== undefined) log.checkInAt = dto.checkInAt ? new Date(dto.checkInAt) : (null as any);
    if (dto.checkOutAt !== undefined) log.checkOutAt = dto.checkOutAt ? new Date(dto.checkOutAt) : (null as any);
    if (dto.note !== undefined) log.note = dto.note;

    if (log.checkInAt && log.checkOutAt && log.checkOutAt <= log.checkInAt) {
      throw new BadRequestException('Giờ ra phải sau giờ vào');
    }

    // Tính lại toàn bộ chỉ số theo giờ làm việc của ca trong ngày đó.
    const calc = log.checkInAt
      ? this.computeAgainstShift(
          log.shift,
          this.vnMinutesFromMidnight(log.checkInAt),
          log.checkOutAt ? this.vnMinutesFromMidnight(log.checkOutAt) : null,
        )
      : null;

    if (calc) {
      log.expectedMinutes = calc.expectedMinutes;
      log.lateMinutes = calc.lateMinutes;
      log.earlyLeaveMinutes = log.checkOutAt ? calc.earlyLeaveMinutes : 0;
      log.workedMinutes = log.checkOutAt ? calc.workedMinutes : 0;
    } else {
      log.lateMinutes = 0;
      log.earlyLeaveMinutes = 0;
      log.workedMinutes = log.checkInAt && log.checkOutAt
        ? Math.max(0, Math.floor((log.checkOutAt.getTime() - log.checkInAt.getTime()) / 60000))
        : 0;
    }

    // Trạng thái: ưu tiên giá trị người sửa chọn, không thì suy ra từ giờ.
    if (dto.status !== undefined) {
      log.status = dto.status;
    } else if (log.checkInAt) {
      log.status = calc && log.checkOutAt
        ? this.statusFromCalc(calc)
        : (log.lateMinutes > 0 ? AttendanceStatus.LATE : AttendanceStatus.PRESENT);
    }

    log.isAdjusted = true;
    await this.logRepo.save(log);
    return this.logRepo.findOne({ where: { id }, relations: { shift: true, user: true } });
  }

  async deleteLog(id: number) {
    const log = await this.logRepo.findOne({ where: { id } });
    if (!log) throw new NotFoundException('Không tìm thấy bản ghi chấm công');
    // Xoá hẳn: các yêu cầu điều chỉnh trỏ tới bản ghi này cũng đi theo (FK CASCADE),
    // giữ lại chúng thì thành yêu cầu mồ côi không mở được.
    await this.adjRepo.delete({ logId: id });
    await this.logRepo.remove(log);
    return { message: 'Đã xóa bản ghi chấm công' };
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
    return this.shiftRepo.find({ where: { isActive: true }, order: { id: 'ASC' } });
  }

  /**
   * Bỏ các key mang giá trị `undefined`.
   *
   * tsconfig để target ES2023 nên mỗi field khai báo trong DTO đều thành thuộc
   * tính thật với giá trị undefined. Trải thẳng DTO lên bản ghi cũ vì thế sẽ
   * xoá mất những mốc giờ mà request không gửi kèm.
   */
  private definedOnly<T extends object>(obj: T): Partial<T> {
    return Object.fromEntries(
      Object.entries(obj).filter(([, v]) => v !== undefined),
    ) as Partial<T>;
  }

  /**
   * Chuẩn hoá 'HH:mm' -> 'HH:mm:00' và kiểm tra thứ tự bốn mốc giờ của ca.
   * DB cũng có CHECK tương ứng; kiểm ở đây để trả lỗi tiếng Việt thay vì 500.
   */
  private normalizeShiftTimes<T extends ShiftTimesInput>(dto: T) {
    const norm = (t?: string | null) => {
      if (!t) return null;
      const parts = t.split(':');
      if (parts.length < 2) throw new BadRequestException(`Giờ không hợp lệ: ${t}`);
      return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}:00`;
    };

    const times = {
      morningStart: norm(dto.morningStart),
      morningEnd: norm(dto.morningEnd),
      afternoonStart: norm(dto.afternoonStart),
      afternoonEnd: norm(dto.afternoonEnd),
    };

    const hasMorning = !!(times.morningStart || times.morningEnd);
    const hasAfternoon = !!(times.afternoonStart || times.afternoonEnd);
    if (hasMorning && !(times.morningStart && times.morningEnd)) {
      throw new BadRequestException('Buổi sáng phải có cả giờ vào và giờ tan');
    }
    if (hasAfternoon && !(times.afternoonStart && times.afternoonEnd)) {
      throw new BadRequestException('Buổi chiều phải có cả giờ vào và giờ tan');
    }
    if (!hasMorning && !hasAfternoon) {
      throw new BadRequestException('Ca làm việc phải có ít nhất một buổi');
    }

    const ms = this.timeToMinutes(times.morningStart);
    const me = this.timeToMinutes(times.morningEnd);
    const as = this.timeToMinutes(times.afternoonStart);
    const ae = this.timeToMinutes(times.afternoonEnd);
    if (ms !== null && me !== null && me <= ms) {
      throw new BadRequestException('Giờ tan buổi sáng phải sau giờ vào buổi sáng');
    }
    if (as !== null && ae !== null && ae <= as) {
      throw new BadRequestException('Giờ tan buổi chiều phải sau giờ vào buổi chiều');
    }
    if (me !== null && as !== null && as < me) {
      throw new BadRequestException('Giờ vào buổi chiều phải sau giờ tan buổi sáng');
    }

    return times;
  }

  async createShift(dto: CreateShiftDto) {
    // code unique o DB, ma deleteShift la soft-delete. Neu chi bao trung ma thi
    // ma cua ca da xoa bi khoa vinh vien va nguoi dung khong con thay no de sua.
    const existing = await this.shiftRepo.findOne({ where: { code: dto.code } });
    // normalizeShiftTimes chỉ trả về 4 mốc giờ nên phải trải dto trước, không thì
    // code/name rơi mất và INSERT vi phạm NOT NULL.
    if (existing) {
      if (existing.isActive) throw new ConflictException('Mã ca đã tồn tại');
      Object.assign(existing, this.definedOnly(dto), this.normalizeShiftTimes(dto), { isActive: true });
      return this.shiftRepo.save(existing);
    }
    return this.shiftRepo.save(
      this.shiftRepo.create({ ...dto, ...this.normalizeShiftTimes(dto) }),
    );
  }

  async updateShift(id: number, dto: UpdateShiftDto) {
    const shift = await this.shiftRepo.findOne({ where: { id } });
    if (!shift) throw new NotFoundException('Không tìm thấy ca làm việc');

    if (dto.code && dto.code !== shift.code) {
      const dup = await this.shiftRepo.findOne({ where: { code: dto.code } });
      if (dup) throw new ConflictException('Mã ca đã tồn tại');
    }

    const changes = this.definedOnly(dto);
    Object.assign(shift, changes, this.normalizeShiftTimes({ ...shift, ...changes }));
    await this.shiftRepo.save(shift);
    // Doc lai de tra ve day du field: save() chi tra ve cac cot vua doi.
    return this.shiftRepo.findOne({ where: { id } });
  }

  async deleteShift(id: number) {
    const shift = await this.shiftRepo.findOne({ where: { id } });
    if (!shift) throw new NotFoundException('Không tìm thấy ca làm việc');

    // Bỏ ca mà nhân viên vẫn đang thuộc thì họ chấm công theo một ca đã ngừng
    // dùng — bắt chuyển người sang ca khác trước cho rõ ràng.
    const inUse = await this.userRepo.count({ where: { shiftId: id } });
    if (inUse > 0) {
      throw new ConflictException(
        `Còn ${inUse} nhân viên đang thuộc ca này. Hãy chuyển họ sang ca khác trước.`,
      );
    }

    // Soft-delete: bang cham cong con tham chieu shift_id nen khong xoa han.
    await this.shiftRepo.update(id, { isActive: false });
    return { message: 'Đã ngừng sử dụng ca làm việc' };
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

  /** Ca của nhân viên; chưa được gán thì dùng ca đang hoạt động đầu tiên. */
  private async getShiftForUser(user: User): Promise<Shift | null> {
    if (user.shiftId) {
      const assigned = await this.shiftRepo.findOne({ where: { id: user.shiftId } });
      if (assigned) return assigned;
    }
    const shifts = await this.shiftRepo.find({ where: { isActive: true }, order: { id: 'ASC' } });
    return shifts[0] ?? null;
  }
}
