import {
  Controller, Get, Post, Patch, Body, Param, Query,
  UseGuards, ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import {
  AttendanceService, CheckInDto, CheckOutDto,
  CreateAdjustmentDto, ReviewAdjustmentDto, CreateShiftDto,
} from './attendance.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User, UserRole } from '../../entities/user.entity';

@ApiTags('Attendance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(private attendanceService: AttendanceService) {}

  @Post('check-in')
  checkIn(@Body() dto: CheckInDto, @CurrentUser() user: User) {
    return this.attendanceService.checkIn(user, dto);
  }

  @Post('check-out')
  checkOut(@Body() dto: CheckOutDto, @CurrentUser() user: User) {
    return this.attendanceService.checkOut(user, dto);
  }

  @Get('today')
  getToday(@CurrentUser() user: User) {
    return this.attendanceService.getTodayStatus(user.id);
  }

  @Get('my')
  @ApiQuery({ name: 'year', required: false })
  @ApiQuery({ name: 'month', required: false })
  getMyLogs(
    @CurrentUser() user: User,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    const now = new Date();
    return this.attendanceService.getMyLogs(
      user.id,
      year ? +year : now.getFullYear(),
      month ? +month : now.getMonth() + 1,
    );
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.GIAM_DOC, UserRole.QUAN_LY)
  @ApiQuery({ name: 'year', required: false })
  @ApiQuery({ name: 'month', required: false })
  @ApiQuery({ name: 'userId', required: false })
  getAllLogs(
    @Query('year') year?: string,
    @Query('month') month?: string,
    @Query('userId') userId?: string,
  ) {
    const now = new Date();
    return this.attendanceService.getAllLogs(
      year ? +year : now.getFullYear(),
      month ? +month : now.getMonth() + 1,
      userId,
    );
  }

  @Post('adjustments')
  @UseGuards(RolesGuard)
  @Roles(UserRole.GIAM_DOC)
  createAdjustment(@Body() dto: CreateAdjustmentDto, @CurrentUser() user: User) {
    return this.attendanceService.createAdjustment(dto, user);
  }

  @Get('adjustments/pending')
  @UseGuards(RolesGuard)
  @Roles(UserRole.GIAM_DOC, UserRole.QUAN_LY)
  getPendingAdjustments() {
    return this.attendanceService.getPendingAdjustments();
  }

  @Patch('adjustments/:id/review')
  @UseGuards(RolesGuard)
  @Roles(UserRole.GIAM_DOC, UserRole.QUAN_LY)
  reviewAdjustment(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewAdjustmentDto,
    @CurrentUser() user: User,
  ) {
    return this.attendanceService.reviewAdjustment(id, dto, user);
  }

  @Get('shifts')
  getShifts() {
    return this.attendanceService.getShifts();
  }

  @Post('shifts')
  @UseGuards(RolesGuard)
  @Roles(UserRole.GIAM_DOC)
  createShift(@Body() dto: CreateShiftDto) {
    return this.attendanceService.createShift(dto);
  }

  @Get('settings')
  @UseGuards(RolesGuard)
  @Roles(UserRole.GIAM_DOC)
  getSettings() {
    return this.attendanceService.getSettings();
  }

  @Patch('settings')
  @UseGuards(RolesGuard)
  @Roles(UserRole.GIAM_DOC)
  updateSettings(@Body() data: any) {
    return this.attendanceService.updateSettings(data);
  }
}
