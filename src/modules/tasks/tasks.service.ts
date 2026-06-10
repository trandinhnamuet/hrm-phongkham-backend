import {
  Injectable, NotFoundException, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import {
  IsEnum, IsOptional, IsString, IsUUID, IsDateString,
} from 'class-validator';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Task, TaskPriority, TaskStatus } from '../../entities/task.entity';
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
    @InjectRepository(TaskComment) private commentRepo: Repository<TaskComment>,
    @InjectRepository(TaskAttachment) private attachRepo: Repository<TaskAttachment>,
  ) {}

  async findAll(user: User, filters: { status?: TaskStatus; assigneeId?: string; priority?: TaskPriority }) {
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
    const task = this.taskRepo.create({
      title: dto.title,
      description: dto.description,
      createdById: user.id,
      assigneeId: dto.assigneeId || user.id,
      priority: dto.priority || TaskPriority.NORMAL,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
    });
    return this.taskRepo.save(task);
  }

  async update(id: number, dto: UpdateTaskDto, user: User) {
    const task = await this.taskRepo.findOne({ where: { id, deletedAt: IsNull() as any } });
    if (!task) throw new NotFoundException('Không tìm thấy công việc');
    this.checkWriteAccess(task, user);

    if (dto.status === TaskStatus.DONE && task.status !== TaskStatus.DONE) {
      task.completedAt = new Date();
    } else if (dto.status && dto.status !== TaskStatus.DONE) {
      task.completedAt = null as unknown as Date;
    }

    Object.assign(task, dto);
    if (dto.dueDate) task.dueDate = new Date(dto.dueDate);
    return this.taskRepo.save(task);
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
