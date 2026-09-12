import {
  Controller, Get, Patch, Param, Query, UseGuards, ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../entities/user.entity';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private service: NotificationsService) {}

  @Get()
  @ApiQuery({ name: 'limit', required: false })
  list(
    @CurrentUser() user: User,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.service.listMine(user.id, limit ?? 50);
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() user: User) {
    return this.service.unreadCount(user.id);
  }

  @Patch('read-all')
  readAll(@CurrentUser() user: User) {
    return this.service.markAllRead(user.id);
  }

  @Patch(':id/read')
  read(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.service.markRead(id, user.id);
  }
}
