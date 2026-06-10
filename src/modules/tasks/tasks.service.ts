import {
  Injectable, NotFoundException, ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import {
  IsEnum, IsOptional, IsString, IsUUID, IsDateString,
} from 'class-validator';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Task, TaskPriority, TaskStatus } from '../../entities/task.entity';
import { TaskHistory } from '../../entities/task-history.entity';
import { TaskComment } from '../../entities/task-comment.entity';
import { TaskAttachment } from '../../entities/task-attachment.entity';
import { User, UserRole } from '../../entities/user.entity';

export class CreateTaskDto {
  @ApiProperty() @IsString() title: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() assigneeId?: string;
  @ApiPropertyOptional() @IsOptional() @IsEnum(TaskPriority) priority?: TaskPriority;
  @ApiPropertyOptional() @IsOptional() @IsDateString() dueDate?: string;
}

export class UpdateTaskDto {
  @ApiPropertyOptional() @IsOptional() @IsString() title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() assigneeId?: string;
  @ApiPropertyOptional() @IsOptional() @IsEnum(TaskPriority) priority?: TaskPriority;
  @ApiPropertyOptional() @IsOptional() @IsEnum(TaskStatus) status?: TaskStatus;
  @ApiPropertyOptional() @IsOptional() @IsDateString() dueDate?: string;
}

export class CreateCommentDto {
  @ApiProperty() @IsString() body: string;
}

export class CreateAttachmentDto {
  @ApiProperty() @IsString() fileName: string;
  @ApiProperty() @IsString() fileUrl: string;
  @ApiPropertyOptional() @IsOptional() @IsString() mimeType?: string;
  @ApiPropertyOptional() @IsOptional() sizeBytes?: number;
}

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task) private taskRepo: Repository<Task>,
    @InjectRepository(TaskHistory) private historyRepo: Repository<TaskHistory>,
    @InjectRepository(TaskComment) private commentRepo: Repository<TaskComment>,
    @InjectRepository(TaskAttachment) private attachRepo: Repository<TaskAttachment>,
  ) {}

  async findAll(user: User, filters: { status?: TaskStatus; assigneeId?: string; priority?: TaskPriority }) {
    // Lazy overdue detection: mark any TODO/IN_PROGRESS past due_date as QUA_HAN
    await this.taskRepo
      .createQueryBuilder()
      .update(Task)
      .set({ status: TaskStatus.QUA_HAN })
      .where('status IN (:...statuses)', { statuses: [TaskStatus.TODO, TaskStatus.IN_PROGRESS] })
      .andWhere('due_date < CURRENT_DATE')
      .andWhere('deleted_at IS NULL')
      .execute();

    const qb = this.taskRepo
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.createdBy', 'creator')
      .leftJoinAndSelect('t.assignee', 'assignee')
      .where('t.deleted_at IS NULL')
      .orderBy('t.created_at', 'DESC');

    if (user.role === UserRole.NHAN_VIEN) {
      qb.andWhere('(t.created_by = :uid OR t.assignee_id = :uid)', { uid: user.id });
    }
    if (filters.status) qb.andWhere('t.status = :s', { s: filters.status });
    if (filters.assigneeId) qb.andWhere('t.assignee_id = :a', { a: filters.assigneeId });
    if (filters.priority) qb.andWhere('t.priority = :p', { p: filters.priority });

    return qb.getMany();
  }

  async findOne(id: number, user: User) {
    const task = await this.taskRepo.findOne({
      where: { id, deletedAt: IsNull() as any },
      relations: {
        createdBy: true,
        assignee: true,
        comments: { user: true },
        attachments: { uploadedBy: true },
      },
    });
    if (!task) throw new NotFoundException('Không tìm thấy công việc');
    this.checkReadAccess(task, user);
    return task;
  }

  async create(dto: CreateTaskDto, user: User) {
    if (user.role === UserRole.NHAN_VIEN && dto.assigneeId && dto.assigneeId !== user.id) {
      throw new ForbiddenException('Nhân viên chỉ được tạo task cho bản thân');
    }
    const task = await this.taskRepo.save(this.taskRepo.create({
      title: dto.title,
      description: dto.description,
      createdById: user.id,
      assigneeId: dto.assigneeId || user.id,
      priority: dto.priority || TaskPriority.NORMAL,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
    }));

    await this.historyRepo.save(this.historyRepo.create({
      taskId: Number(task.id),
      changedById: user.id,
      changeType: 'CREATED',
    }));

    return task;
  }

  async update(id: number, dto: UpdateTaskDto, user: User) {
    const task = await this.taskRepo.findOne({ where: { id, deletedAt: IsNull() as any } });
    if (!task) throw new NotFoundException('Không tìm thấy công việc');
    this.checkWriteAccess(task, user);

    // QUA_HAN tasks can only move to DONE
    if (
      task.status === TaskStatus.QUA_HAN &&
      dto.status &&
      dto.status !== TaskStatus.DONE &&
      dto.status !== TaskStatus.QUA_HAN
    ) {
      throw new BadRequestException('Công việc quá hạn chỉ có thể chuyển sang Hoàn thành');
    }

    const entries: Array<{ fieldName: string; oldValue: string; newValue: string }> = [];

    const track = (field: string, oldVal: any, newVal: any) => {
      const o = String(oldVal ?? '');
      const n = String(newVal ?? '');
      if (o !== n) entries.push({ fieldName: field, oldValue: o, newValue: n });
    };

    if (dto.status !== undefined && dto.status !== task.status) {
      track('status', task.status, dto.status);
      task.status = dto.status;
      if (dto.status === TaskStatus.DONE) task.completedAt = new Date();
      else task.completedAt = null as any;
    }
    if (dto.title !== undefined && dto.title !== task.title) {
      track('title', task.title, dto.title);
      task.title = dto.title;
    }
    if (dto.description !== undefined && dto.description !== task.description) {
      track('description', task.description, dto.description);
      task.description = dto.description;
    }
    if (dto.assigneeId !== undefined && dto.assigneeId !== task.assigneeId) {
      track('assigneeId', task.assigneeId, dto.assigneeId);
      task.assigneeId = dto.assigneeId;
    }
    if (dto.priority !== undefined && dto.priority !== task.priority) {
      track('priority', task.priority, dto.priority);
      task.priority = dto.priority;
    }
    if (dto.dueDate !== undefined) {
      const oldDate = task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '';
      if (oldDate !== dto.dueDate) {
        track('dueDate', oldDate, dto.dueDate);
        task.dueDate = new Date(dto.dueDate);
      }
    }

    await this.taskRepo.save(task);

    if (entries.length > 0) {
      const records = entries.map(e => this.historyRepo.create({
        taskId: id,
        changedById: user.id,
        changeType: e.fieldName === 'status' ? 'STATUS_CHANGE' : 'FIELD_UPDATE',
        fieldName: e.fieldName,
        oldValue: e.oldValue,
        newValue: e.newValue,
      }));
      await this.historyRepo.save(records);
    }

    return task;
  }

  async getHistory(taskId: number, user: User) {
    const task = await this.taskRepo.findOne({ where: { id: taskId, deletedAt: IsNull() as any } });
    if (!task) throw new NotFoundException('Không tìm thấy công việc');
    this.checkReadAccess(task, user);
    return this.historyRepo.find({
      where: { taskId },
      relations: { changedBy: true },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async remove(id: number, user: User) {
    const task = await this.taskRepo.findOne({ where: { id, deletedAt: IsNull() as any } });
    if (!task) throw new NotFoundException('Không tìm thấy công việc');
    if (user.role === UserRole.NHAN_VIEN && task.createdById !== user.id) {
      throw new ForbiddenException('Không có quyền xóa công việc này');
    }
    task.deletedAt = new Date();
    await this.taskRepo.save(task);
    return { message: 'Đã xóa công việc' };
  }

  async addComment(taskId: number, dto: CreateCommentDto, user: User) {
    const task = await this.taskRepo.findOne({ where: { id: taskId, deletedAt: IsNull() as any } });
    if (!task) throw new NotFoundException('Không tìm thấy công việc');
    this.checkReadAccess(task, user);
    const comment = this.commentRepo.create({ taskId, userId: user.id, body: dto.body });
    return this.commentRepo.save(comment);
  }

  async deleteComment(commentId: number, user: User) {
    const comment = await this.commentRepo.findOne({ where: { id: commentId } });
    if (!comment) throw new NotFoundException('Không tìm thấy bình luận');
    if (comment.userId !== user.id && user.role === UserRole.NHAN_VIEN) {
      throw new ForbiddenException('Không có quyền xóa bình luận này');
    }
    comment.deletedAt = new Date();
    await this.commentRepo.save(comment);
    return { message: 'Đã xóa bình luận' };
  }

  async addAttachment(taskId: number, dto: CreateAttachmentDto, user: User) {
    const task = await this.taskRepo.findOne({ where: { id: taskId, deletedAt: IsNull() as any } });
    if (!task) throw new NotFoundException('Không tìm thấy công việc');
    this.checkReadAccess(task, user);
    const att = this.attachRepo.create({ taskId, uploadedById: user.id, ...dto });
    return this.attachRepo.save(att);
  }

  async deleteAttachment(attachId: number, user: User) {
    const att = await this.attachRepo.findOne({ where: { id: attachId } });
    if (!att) throw new NotFoundException('Không tìm thấy tệp đính kèm');
    if (att.uploadedById !== user.id && user.role === UserRole.NHAN_VIEN) {
      throw new ForbiddenException('Không có quyền xóa tệp này');
    }
    await this.attachRepo.remove(att);
    return { message: 'Đã xóa tệp đính kèm' };
  }

  private checkReadAccess(task: Task, user: User) {
    if (user.role !== UserRole.NHAN_VIEN) return;
    if (task.createdById !== user.id && task.assigneeId !== user.id) {
      throw new ForbiddenException('Không có quyền xem công việc này');
    }
  }

  private checkWriteAccess(task: Task, user: User) {
    if (user.role === UserRole.GIAM_DOC) return;
    if (user.role === UserRole.QUAN_LY) return;
    if (task.createdById !== user.id && task.assigneeId !== user.id) {
      throw new ForbiddenException('Không có quyền chỉnh sửa công việc này');
    }
  }
}
