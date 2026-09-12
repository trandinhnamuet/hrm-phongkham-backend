import {
  Injectable, NotFoundException, ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, IsNull } from 'typeorm';
import {
  IsArray, IsEnum, IsIn, IsOptional, IsString, IsUUID, IsDateString,
} from 'class-validator';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Task, TaskPriority, TaskStatus, TaskReviewStatus } from '../../entities/task.entity';
import { TaskHistory } from '../../entities/task-history.entity';
import { TaskComment } from '../../entities/task-comment.entity';
import { TaskAttachment } from '../../entities/task-attachment.entity';
import { User, UserRole } from '../../entities/user.entity';
import { NotificationType } from '../../entities/notification.entity';
import { NotificationsService } from '../notifications/notifications.service';

export class CreateTaskDto {
  @ApiProperty() @IsString() title: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;

  @ApiPropertyOptional({ type: [String], description: 'Danh sách người được giao' })
  @IsOptional() @IsArray() @IsUUID('all', { each: true })
  assigneeIds?: string[];

  /** Cũ, chỉ giao được 1 người. Dùng assigneeIds. Giữ để client cũ không hỏng. */
  @ApiPropertyOptional({ deprecated: true })
  @IsOptional() @IsUUID()
  assigneeId?: string;

  @ApiPropertyOptional() @IsOptional() @IsEnum(TaskPriority) priority?: TaskPriority;
  @ApiPropertyOptional() @IsOptional() @IsDateString() dueDate?: string;
}

export class UpdateTaskDto {
  @ApiPropertyOptional() @IsOptional() @IsString() title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;

  @ApiPropertyOptional({ type: [String], description: 'Danh sách người được giao (thay thế toàn bộ)' })
  @IsOptional() @IsArray() @IsUUID('all', { each: true })
  assigneeIds?: string[];

  /** Cũ, chỉ giao được 1 người. Dùng assigneeIds. Giữ để client cũ không hỏng. */
  @ApiPropertyOptional({ deprecated: true })
  @IsOptional() @IsUUID()
  assigneeId?: string;

  @ApiPropertyOptional() @IsOptional() @IsEnum(TaskPriority) priority?: TaskPriority;
  @ApiPropertyOptional() @IsOptional() @IsEnum(TaskStatus) status?: TaskStatus;
  @ApiPropertyOptional() @IsOptional() @IsDateString() dueDate?: string;
}

export class ReviewTaskDto {
  @ApiProperty({ enum: ['ACCEPTED', 'RETURNED'] })
  @IsIn(['ACCEPTED', 'RETURNED'])
  decision: 'ACCEPTED' | 'RETURNED';

  /** Bắt buộc khi trả lại: nhân viên cần biết phải sửa gì. */
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
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
    @InjectRepository(Task)           private taskRepo:    Repository<Task>,
    @InjectRepository(TaskHistory)    private historyRepo: Repository<TaskHistory>,
    @InjectRepository(TaskComment)    private commentRepo: Repository<TaskComment>,
    @InjectRepository(TaskAttachment) private attachRepo:  Repository<TaskAttachment>,
    @InjectRepository(User)           private userRepo:    Repository<User>,
    private notifications: NotificationsService,
  ) {}

  /** Đường dẫn mở thẳng hộp chi tiết của một công việc trên frontend. */
  private taskLink(id: number | string) { return `/tasks?task=${id}`; }

  /**
   * Cấp trên của những người được giao: quản lý phụ trách bộ phận của họ.
   * Chỉ lấy quản lý theo bộ phận, không báo cho toàn bộ Giám đốc — việc hoàn
   * thành diễn ra liên tục, báo hết cho mọi người thì thành nhiễu.
   */
  private async resolveSupervisors(assignees: User[]): Promise<string[]> {
    const deptIds = [...new Set(
      assignees.map(a => Number(a.departmentId)).filter(d => Number.isFinite(d)),
    )];
    if (deptIds.length === 0) return [];

    const explicit = await this.userRepo
      .createQueryBuilder('u')
      .innerJoin('u.managedDepartments', 'd')
      .where('d.id IN (:...deptIds)', { deptIds })
      .select(['u.id'])
      .getMany();

    // Quản lý chưa được gắn bộ phận riêng thì coi bộ phận của chính họ là phụ trách.
    const implicit = await this.userRepo.find({
      where: { role: UserRole.QUAN_LY },
      select: { id: true, departmentId: true } as any,
    });

    return [...new Set([
      ...explicit.map(u => u.id),
      ...implicit.filter(u => deptIds.includes(Number(u.departmentId))).map(u => u.id),
    ])];
  }

  /* ── helpers ── */

  private async resolveManagerDeptIds(managerId: string): Promise<number[]> {
    const mgr = await this.userRepo.findOne({
      where: { id: managerId },
      relations: { managedDepartments: true },
    });
    const explicit = (mgr?.managedDepartments ?? []).map(d => Number(d.id));
    if (explicit.length > 0) return explicit;
    return mgr?.departmentId ? [Number(mgr.departmentId)] : [];
  }

  private isAssignee(task: Task, userId: string): boolean {
    return (task.assignees ?? []).some(a => a.id === userId);
  }

  /**
   * assigneeIds là nguồn chính. assigneeId (số ít) chỉ để tương thích client cũ:
   * assigneeId = null nghĩa là bỏ giao hết, khác với undefined nghĩa là không đổi.
   */
  private resolveAssigneeIds(
    dto: { assigneeIds?: string[]; assigneeId?: string | null },
  ): string[] | undefined {
    if (dto.assigneeIds !== undefined) return [...new Set(dto.assigneeIds)];
    if (dto.assigneeId !== undefined) return dto.assigneeId ? [dto.assigneeId] : [];
    return undefined;
  }

  private async loadAssignees(ids: string[]): Promise<User[]> {
    if (ids.length === 0) return [];
    const users = await this.userRepo.findBy({ id: In(ids) });
    if (users.length !== ids.length) {
      const found = new Set(users.map(u => u.id));
      throw new BadRequestException(
        'Không tìm thấy nhân viên: ' + ids.filter(i => !found.has(i)).join(', '),
      );
    }
    return users;
  }

  /** Ai được giao việc cho ai. Giám đốc giao cho tất cả, quản lý giao trong bộ phận mình. */
  private async assertCanAssign(user: User, assignees: User[]): Promise<void> {
    if (user.role === UserRole.GIAM_DOC) return;

    const others = assignees.filter(a => a.id !== user.id);
    if (others.length === 0) return;

    if (user.role === UserRole.NHAN_VIEN) {
      throw new ForbiddenException('Nhân viên chỉ được tạo task cho bản thân');
    }

    const deptIds = await this.resolveManagerDeptIds(user.id);
    const outside = others.filter(a => !deptIds.includes(Number(a.departmentId)));
    if (outside.length > 0) {
      throw new ForbiddenException(
        'Quản lý chỉ có thể giao việc cho nhân viên trong bộ phận của mình. '
        + 'Không thuộc bộ phận bạn quản lý: ' + outside.map(o => o.fullName).join(', '),
      );
    }
  }

  /**
   * Giữ 2 field cũ assignee / assigneeId trong response (= người đầu tiên) để
   * frontend chưa kịp deploy không hỏng trong lúc chuyển đổi sang assignees.
   */
  private withLegacyAssignee<T extends Task>(task: T): T {
    const first = (task.assignees ?? [])[0] ?? null;
    (task as any).assignee = first;
    (task as any).assigneeId = first ? first.id : null;
    return task;
  }

  private async checkReadAccess(task: Task, user: User): Promise<void> {
    if (user.role === UserRole.GIAM_DOC) return;

    if (user.role === UserRole.QUAN_LY) {
      if (task.createdById === user.id || this.isAssignee(task, user.id)) return;
      const deptIds = await this.resolveManagerDeptIds(user.id);
      if (deptIds.length > 0
        && (task.assignees ?? []).some(a => deptIds.includes(Number(a.departmentId)))) return;
      throw new ForbiddenException('Không có quyền xem công việc này');
    }

    if (task.createdById !== user.id && !this.isAssignee(task, user.id)) {
      throw new ForbiddenException('Không có quyền xem công việc này');
    }
  }

  private async checkWriteAccess(task: Task, user: User): Promise<void> {
    if (user.role === UserRole.GIAM_DOC) return;

    if (user.role === UserRole.QUAN_LY) {
      if (task.createdById === user.id || this.isAssignee(task, user.id)) return;
      const deptIds = await this.resolveManagerDeptIds(user.id);
      if (deptIds.length > 0
        && (task.assignees ?? []).some(a => deptIds.includes(Number(a.departmentId)))) return;
      throw new ForbiddenException('Không có quyền chỉnh sửa công việc này');
    }

    if (task.createdById !== user.id && !this.isAssignee(task, user.id)) {
      throw new ForbiddenException('Không có quyền chỉnh sửa công việc này');
    }
  }

  /** Nạp task kèm danh sách người được giao — cần cho mọi kiểm tra quyền. */
  private async findTaskOrFail(id: number): Promise<Task> {
    const task = await this.taskRepo.findOne({
      where: { id, deletedAt: IsNull() as any },
      relations: { assignees: true },
    });
    if (!task) throw new NotFoundException('Không tìm thấy công việc');
    return task;
  }

  /* ── CRUD ── */

  async findAll(user: User, filters: { status?: TaskStatus; assigneeId?: string; priority?: TaskPriority }) {
    await this.taskRepo
      .createQueryBuilder()
      .update(Task)
      .set({ status: TaskStatus.QUA_HAN, statusChangedAt: () => 'now()' })
      .where('status IN (:...statuses)', { statuses: [TaskStatus.TODO, TaskStatus.IN_PROGRESS] })
      .andWhere('due_date < CURRENT_DATE')
      .andWhere('deleted_at IS NULL')
      .execute();

    const qb = this.taskRepo
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.createdBy', 'creator')
      .leftJoinAndSelect('t.assignees', 'assignee')
      .leftJoinAndSelect('t.reviewedBy', 'reviewer')
      .where('t.deleted_at IS NULL')
      // Sắp theo thời điểm đổi trạng thái gần nhất (mới nhất lên đầu)
      .orderBy('COALESCE(t.status_changed_at, t.created_at)', 'DESC');

    // Lọc bằng EXISTS chứ không đặt điều kiện lên bảng join đã select — nếu không,
    // danh sách assignees trả về sẽ bị cắt chỉ còn người khớp điều kiện.
    const isMine = `(t.created_by = :uid OR EXISTS (
      SELECT 1 FROM "HRM"."task_assignees" ta
      WHERE ta.task_id = t.id AND ta.user_id = :uid))`;

    if (user.role === UserRole.NHAN_VIEN) {
      qb.andWhere(isMine, { uid: user.id });
    } else if (user.role === UserRole.QUAN_LY) {
      const deptIds = await this.resolveManagerDeptIds(user.id);
      if (deptIds.length > 0) {
        qb.andWhere(
          `(t.created_by = :uid OR EXISTS (
             SELECT 1 FROM "HRM"."task_assignees" ta
             JOIN "HRM"."users" u ON u.id = ta.user_id
             WHERE ta.task_id = t.id
               AND (ta.user_id = :uid OR u.department_id IN (:...deptIds))))`,
          { uid: user.id, deptIds },
        );
      } else {
        qb.andWhere(isMine, { uid: user.id });
      }
    }

    if (filters.status)   qb.andWhere('t.status = :s',   { s: filters.status });
    if (filters.priority) qb.andWhere('t.priority = :p', { p: filters.priority });
    if (filters.assigneeId) {
      qb.andWhere(
        `EXISTS (SELECT 1 FROM "HRM"."task_assignees" taf
                 WHERE taf.task_id = t.id AND taf.user_id = :fa)`,
        { fa: filters.assigneeId },
      );
    }

    const tasks = await qb.getMany();
    return tasks.map(t => this.withLegacyAssignee(t));
  }

  async findOne(id: number, user: User) {
    const task = await this.taskRepo.findOne({
      where: { id, deletedAt: IsNull() as any },
      relations: {
        createdBy: true,
        assignees: true,
        reviewedBy: true,
        comments: { user: true },
        attachments: { uploadedBy: true },
      },
    });
    if (!task) throw new NotFoundException('Không tìm thấy công việc');
    await this.checkReadAccess(task, user);
    return this.withLegacyAssignee(task);
  }

  async create(dto: CreateTaskDto, user: User) {
    const requested = this.resolveAssigneeIds(dto);
    // Không chỉ định ai thì giao cho chính người tạo (giữ hành vi cũ).
    const ids = requested && requested.length > 0 ? requested : [user.id];
    const assignees = await this.loadAssignees(ids);
    await this.assertCanAssign(user, assignees);

    const task = await this.taskRepo.save(this.taskRepo.create({
      title: dto.title,
      description: dto.description,
      createdById: user.id,
      assignees,
      priority: dto.priority || TaskPriority.NORMAL,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      statusChangedAt: new Date(),
    }));

    await this.historyRepo.save(this.historyRepo.create({
      taskId: Number(task.id),
      changedById: user.id,
      changeType: 'CREATED',
    }));

    task.assignees = assignees;

    await this.notifications.notify({
      userIds: assignees.map(a => a.id),
      actorId: user.id,
      type: NotificationType.TASK_ASSIGNED,
      title: `${user.fullName} giao việc cho bạn: ${task.title}`,
      body: task.description,
      link: this.taskLink(task.id),
    });

    return this.withLegacyAssignee(task);
  }

  async update(id: number, dto: UpdateTaskDto, user: User) {
    const task = await this.findTaskOrFail(id);
    await this.checkWriteAccess(task, user);

    if (
      task.status === TaskStatus.QUA_HAN &&
      dto.status &&
      dto.status !== TaskStatus.DONE &&
      dto.status !== TaskStatus.QUA_HAN
    ) {
      throw new BadRequestException('Công việc quá hạn chỉ có thể chuyển sang Hoàn thành');
    }

    // Chỉ kiểm tra quyền trên những người MỚI được thêm vào.
    const requested = this.resolveAssigneeIds(dto);
    let newAssignees: User[] | undefined;
    if (requested !== undefined) {
      newAssignees = await this.loadAssignees(requested);
      const currentIds = new Set((task.assignees ?? []).map(a => a.id));
      const added = newAssignees.filter(a => !currentIds.has(a.id));
      if (added.length > 0) await this.assertCanAssign(user, added);
    }

    let justCompleted = false;
    const entries: Array<{ fieldName: string; oldValue: string; newValue: string }> = [];
    const track = (field: string, oldVal: any, newVal: any) => {
      const o = String(oldVal ?? '');
      const n = String(newVal ?? '');
      if (o !== n) entries.push({ fieldName: field, oldValue: o, newValue: n });
    };

    if (dto.status !== undefined && dto.status !== task.status) {
      track('status', task.status, dto.status);
      task.status = dto.status;
      task.statusChangedAt = new Date();
      if (dto.status === TaskStatus.DONE) {
        justCompleted = true;
        task.completedAt = new Date();
        // Báo xong là chuyển sang chờ người giao việc đánh giá. Kể cả việc đã bị
        // trả lại rồi làm lại cũng quay về chờ đánh giá.
        task.reviewStatus = TaskReviewStatus.PENDING_REVIEW;
        task.reviewedById = null;
        task.reviewedAt = null;
      } else {
        task.completedAt = null as any;
        // Rời khỏi Hoàn thành thì kết quả đánh giá cũ không còn ý nghĩa,
        // trừ khi đang là RETURNED (nhân viên đang sửa lại theo góp ý).
        if (task.reviewStatus !== TaskReviewStatus.RETURNED) {
          task.reviewStatus = null;
        }
      }
    }
    if (dto.title       !== undefined && dto.title       !== task.title)       { track('title', task.title, dto.title);             task.title       = dto.title; }
    if (dto.description !== undefined && dto.description !== task.description) { track('description', task.description, dto.description); task.description = dto.description; }
    if (dto.priority    !== undefined && dto.priority    !== task.priority)    { track('priority', task.priority, dto.priority);    task.priority    = dto.priority; }
    if (dto.dueDate !== undefined) {
      const oldDate = task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '';
      if (oldDate !== dto.dueDate) {
        track('dueDate', oldDate, dto.dueDate);
        task.dueDate = new Date(dto.dueDate);
      }
    }
    let newlyAdded: User[] = [];
    if (newAssignees !== undefined) {
      const oldIds = new Set((task.assignees ?? []).map(a => a.id));
      const oldList = [...oldIds].sort().join(',');
      const newList = newAssignees.map(a => a.id).sort().join(',');
      if (oldList !== newList) {
        track('assigneeIds', oldList, newList);
        newlyAdded = newAssignees.filter(a => !oldIds.has(a.id));
        task.assignees = newAssignees;
      }
    }

    await this.taskRepo.save(task);

    if (entries.length > 0) {
      await this.historyRepo.save(entries.map(e => this.historyRepo.create({
        taskId: id,
        changedById: user.id,
        changeType: e.fieldName === 'status' ? 'STATUS_CHANGE' : 'FIELD_UPDATE',
        fieldName: e.fieldName,
        oldValue: e.oldValue,
        newValue: e.newValue,
      })));
    }

    if (newlyAdded.length > 0) {
      await this.notifications.notify({
        userIds: newlyAdded.map(a => a.id),
        actorId: user.id,
        type: NotificationType.TASK_ASSIGNED,
        title: `${user.fullName} giao việc cho bạn: ${task.title}`,
        body: task.description,
        link: this.taskLink(task.id),
      });
    }

    // Báo hoàn thành: người giao việc và quản lý bộ phận cần biết để đánh giá.
    if (justCompleted) {
      const supervisors = await this.resolveSupervisors(task.assignees ?? []);
      await this.notifications.notify({
        userIds: [task.createdById, ...supervisors],
        actorId: user.id,
        type: NotificationType.TASK_COMPLETED,
        title: `${user.fullName} báo hoàn thành: ${task.title}`,
        body: 'Công việc đang chờ bạn đánh giá.',
        link: this.taskLink(task.id),
      });
    }

    return this.withLegacyAssignee(task);
  }

  /** Ai được đánh giá: người giao việc, Giám đốc, hoặc Quản lý phụ trách bộ phận. */
  private async checkReviewAccess(task: Task, user: User): Promise<void> {
    if (user.role === UserRole.GIAM_DOC) return;
    if (task.createdById === user.id) return;
    if (user.role === UserRole.QUAN_LY) {
      const deptIds = await this.resolveManagerDeptIds(user.id);
      if (deptIds.length > 0
        && (task.assignees ?? []).some(a => deptIds.includes(Number(a.departmentId)))) return;
    }
    throw new ForbiddenException('Chỉ người giao việc hoặc quản lý mới được đánh giá công việc này');
  }

  async review(id: number, dto: ReviewTaskDto, user: User) {
    const task = await this.findTaskOrFail(id);
    await this.checkReviewAccess(task, user);

    if (task.status !== TaskStatus.DONE) {
      throw new BadRequestException('Chỉ đánh giá được công việc đã báo hoàn thành');
    }

    const note = (dto.note ?? '').trim();
    if (dto.decision === 'RETURNED' && !note) {
      throw new BadRequestException('Cần ghi góp ý để nhân viên biết phải sửa gì');
    }

    const before = task.reviewStatus;
    task.reviewStatus = dto.decision === 'ACCEPTED'
      ? TaskReviewStatus.ACCEPTED
      : TaskReviewStatus.RETURNED;
    task.reviewNote = note || null;
    task.reviewedById = user.id;
    task.reviewedAt = new Date();

    // Trả lại thì đưa việc về Cần làm để nhân viên bắt đầu lại từ đầu.
    if (dto.decision === 'RETURNED') {
      task.status = TaskStatus.TODO;
      task.statusChangedAt = new Date();
      task.completedAt = null as any;
    }

    await this.taskRepo.save(task);

    await this.historyRepo.save(this.historyRepo.create({
      taskId: id,
      changedById: user.id,
      changeType: 'FIELD_UPDATE',
      fieldName: 'reviewStatus',
      oldValue: String(before ?? ''),
      newValue: String(task.reviewStatus),
    }));

    // Góp ý hiện luôn trong phần bình luận để nhân viên thấy ngay ngữ cảnh.
    if (note) {
      const prefix = dto.decision === 'RETURNED' ? '[Trả lại] ' : '[Đạt] ';
      await this.commentRepo.save(this.commentRepo.create({
        taskId: id, userId: user.id, body: prefix + note,
      }));
    }

    const verdict = dto.decision === 'RETURNED' ? 'Trả lại để làm lại' : 'Đạt';
    await this.notifications.notify({
      userIds: [...(task.assignees ?? []).map(a => a.id), task.createdById],
      actorId: user.id,
      type: NotificationType.TASK_REVIEWED,
      title: `${user.fullName} đánh giá "${task.title}": ${verdict}`,
      body: note || null,
      link: this.taskLink(id),
    });

    return this.withLegacyAssignee(task);
  }

  async getHistory(taskId: number, user: User) {
    const task = await this.findTaskOrFail(taskId);
    await this.checkReadAccess(task, user);
    return this.historyRepo.find({
      where: { taskId },
      relations: { changedBy: true },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async remove(id: number, user: User) {
    const task = await this.findTaskOrFail(id);
    await this.checkWriteAccess(task, user);
    task.deletedAt = new Date();
    await this.taskRepo.save(task);
    return { message: 'Đã xóa công việc' };
  }

  async addComment(taskId: number, dto: CreateCommentDto, user: User) {
    const task = await this.findTaskOrFail(taskId);
    await this.checkReadAccess(task, user);
    const saved = await this.commentRepo.save(
      this.commentRepo.create({ taskId, userId: user.id, body: dto.body }),
    );

    await this.notifications.notify({
      userIds: [...(task.assignees ?? []).map(a => a.id), task.createdById],
      actorId: user.id,
      type: NotificationType.TASK_COMMENT,
      title: `${user.fullName} bình luận về "${task.title}"`,
      body: dto.body,
      link: this.taskLink(taskId),
    });

    return saved;
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
    const task = await this.findTaskOrFail(taskId);
    await this.checkReadAccess(task, user);
    return this.attachRepo.save(this.attachRepo.create({ taskId, uploadedById: user.id, ...dto }));
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
}
