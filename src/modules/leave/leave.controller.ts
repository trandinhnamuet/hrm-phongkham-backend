import {
  Controller, Get, Post, Patch, Body, Param, Query,
  UseGuards, ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { LeaveService, CreateLeaveRequestDto, ReviewLeaveDto } from './leave.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User, UserRole } from '../../entities/user.entity';
import { LeaveRequestStatus } from '../../entities/leave-request.entity';

@ApiTags('Leave')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('leave')
export class LeaveController {
  constructor(private leaveService: LeaveService) {}

  @Get('types')
  getTypes() {
    return this.leaveService.getLeaveTypes();
  }

  @Get('balance/my')
  getMyBalance(@CurrentUser() user: User) {
    return this.leaveService.getMyBalance(user.id);
  }

  @Get('balance/:userId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.GIAM_DOC, UserRole.QUAN_LY)
  getBalance(
    @Param('userId') userId: string,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    return this.leaveService.getBalance(userId, year ? +year : undefined, month ? +month : undefined);
  }

  @Get('requests/my')
  getMyRequests(@CurrentUser() user: User) {
    return this.leaveService.getMyRequests(user.id);
  }

  @Get('requests')
  @UseGuards(RolesGuard)
  @Roles(UserRole.GIAM_DOC, UserRole.QUAN_LY)
  @ApiQuery({ name: 'status', required: false, enum: LeaveRequestStatus })
  getAllRequests(@Query('status') status?: LeaveRequestStatus) {
    return this.leaveService.getAllRequests(status);
  }

  @Post('requests')
  createRequest(@Body() dto: CreateLeaveRequestDto, @CurrentUser() user: User) {
    return this.leaveService.createRequest(dto, user);
  }

  @Patch('requests/:id/review')
  @UseGuards(RolesGuard)
  @Roles(UserRole.GIAM_DOC)
  review(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewLeaveDto,
    @CurrentUser() user: User,
  ) {
    return this.leaveService.reviewRequest(id, dto, user);
  }

  @Patch('requests/:id/cancel')
  cancel(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.leaveService.cancelRequest(id, user);
  }

  @Post('balance/init')
  @UseGuards(RolesGuard)
  @Roles(UserRole.GIAM_DOC)
  initBalance(
    @Body() body: { userId: string; year: number; month: number },
  ) {
    return this.leaveService.initMonthlyBalance(body.userId, body.year, body.month);
  }
}
