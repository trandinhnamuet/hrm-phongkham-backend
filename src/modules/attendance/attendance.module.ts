import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttendanceLog } from '../../entities/attendance-log.entity';
import { AttendanceAdjustment } from '../../entities/attendance-adjustment.entity';
import { ClinicSettings } from '../../entities/clinic-settings.entity';
import { Shift } from '../../entities/shift.entity';
import { User } from '../../entities/user.entity';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';

@Module({
  imports: [TypeOrmModule.forFeature([AttendanceLog, AttendanceAdjustment, ClinicSettings, Shift, User])],
  controllers: [AttendanceController],
  providers: [AttendanceService],
})
export class AttendanceModule {}
