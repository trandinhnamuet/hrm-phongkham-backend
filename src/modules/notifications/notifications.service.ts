import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationType } from '../../entities/notification.entity';

export interface NotifyInput {
  /** Danh sách người nhận. Trùng lặp và chính người gây ra sự kiện sẽ bị loại. */
  userIds: (string | null | undefined)[];
  type: NotificationType;
  title: string;
  body?: string | null;
  link?: string | null;
  actorId?: string | null;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification) private repo: Repository<Notification>,
  ) {}

  /**
   * Tạo thông báo cho nhiều người một lượt.
   * Không bao giờ ném lỗi ra ngoài: thông báo hỏng không được làm hỏng nghiệp vụ
   * chính (bình luận, duyệt đơn) đã lưu xong trước đó.
   */
  async notify(input: NotifyInput): Promise<void> {
    try {
      const ids = [...new Set(input.userIds.filter((u): u is string => !!u))]
        .filter(u => u !== input.actorId);
      if (ids.length === 0) return;

      const rows = ids.map(userId => this.repo.create({
        userId,
        type: input.type,
        title: input.title.slice(0, 200),
        body: input.body?.trim() ? input.body.trim() : null,
        link: input.link ?? null,
        actorId: input.actorId ?? null,
      }));
      await this.repo.save(rows);
    } catch (e) {
      // Ghi log rồi bỏ qua, xem chú thích trên.
      console.error('[notifications] khong tao duoc thong bao:', (e as Error).message);
    }
  }

  listMine(userId: string, limit = 50) {
    return this.repo.find({
      where: { userId },
      relations: { actor: true },
      order: { createdAt: 'DESC' },
      take: Math.min(200, Math.max(1, limit)),
    });
  }

  /**
   * Xoá mọi thông báo trỏ tới một đường dẫn.
   *
   * Dùng khi thứ được nhắc tới không còn nữa: giữ lại thì người dùng bấm vào
   * một thông báo dẫn đến trang trống, tưởng hệ thống hỏng.
   */
  async removeByLink(link: string) {
    await this.repo.delete({ link });
  }

  async unreadCount(userId: string) {
    const count = await this.repo.count({ where: { userId, isRead: false } });
    return { count };
  }

  async markRead(id: number, userId: string) {
    const n = await this.repo.findOne({ where: { id, userId } });
    if (!n) throw new NotFoundException('Không tìm thấy thông báo');
    if (!n.isRead) {
      n.isRead = true;
      await this.repo.save(n);
    }
    return n;
  }

  async markAllRead(userId: string) {
    const r = await this.repo.update({ userId, isRead: false }, { isRead: true });
    return { updated: r.affected ?? 0 };
  }
}
