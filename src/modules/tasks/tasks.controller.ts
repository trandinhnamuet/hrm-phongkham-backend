import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, ParseIntPipe, ParseEnumPipe, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import {
  TasksService, CreateTaskDto, UpdateTaskDto,
  CreateCommentDto, CreateAttachmentDto,
} from './tasks.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../entities/user.entity';
import { TaskStatus, TaskPriority } from '../../entities/task.entity';

@ApiTags('Tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tasks')
export class TasksController {
  constructor(private tasksService: TasksService) {}

  @Get()
  @ApiQuery({ name: 'status', required: false, enum: TaskStatus })
  @ApiQuery({ name: 'priority', required: false, enum: TaskPriority })
  @ApiQuery({ name: 'assigneeId', required: false })
  findAll(
    @CurrentUser() user: User,
    // optional: true -> khong truyen thi bo qua, truyen sai thi 400 (truoc day la 500).
    // Dung pipe tung param thay vi DTO ca cum, vi global ValidationPipe co
    // forbidNonWhitelisted: true se chan ca query param la khong lien quan.
    @Query('status', new ParseEnumPipe(TaskStatus, { optional: true }))
    status?: TaskStatus,
    @Query('priority', new ParseEnumPipe(TaskPriority, { optional: true }))
    priority?: TaskPriority,
    @Query('assigneeId', new ParseUUIDPipe({ optional: true }))
    assigneeId?: string,
  ) {
    return this.tasksService.findAll(user, { status, priority, assigneeId });
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.tasksService.findOne(id, user);
  }

  @Get(':id/history')
  getHistory(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.tasksService.getHistory(id, user);
  }

  @Post()
  create(@Body() dto: CreateTaskDto, @CurrentUser() user: User) {
    return this.tasksService.create(dto, user);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTaskDto,
    @CurrentUser() user: User,
  ) {
    return this.tasksService.update(id, dto, user);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.tasksService.remove(id, user);
  }

  @Post(':id/comments')
  addComment(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: User,
  ) {
    return this.tasksService.addComment(id, dto, user);
  }

  @Delete('comments/:commentId')
  deleteComment(
    @Param('commentId', ParseIntPipe) commentId: number,
    @CurrentUser() user: User,
  ) {
    return this.tasksService.deleteComment(commentId, user);
  }

  @Post(':id/attachments')
  addAttachment(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateAttachmentDto,
    @CurrentUser() user: User,
  ) {
    return this.tasksService.addAttachment(id, dto, user);
  }

  @Delete('attachments/:attachId')
  deleteAttachment(
    @Param('attachId', ParseIntPipe) attachId: number,
    @CurrentUser() user: User,
  ) {
    return this.tasksService.deleteAttachment(attachId, user);
  }
}
