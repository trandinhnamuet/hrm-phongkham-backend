import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeaveRequest } from '../../entities/leave-request.entity';
import { LeaveBalance } from '../../entities/leave-balance.entity';
import { LeaveType } from '../../entities/leave-type.entity';
import { LeaveController } from './leave.controller';
import { LeaveService } from './leave.service';

@Module({
  imports: [TypeOrmModule.forFeature([LeaveRequest, LeaveBalance, LeaveType])],
  controllers: [LeaveController],
  providers: [LeaveService],
})
export class LeaveModule {}
