import { MigrationInterface, QueryRunner } from 'typeorm';

/** Thêm loại thông báo "cấp dưới báo hoàn thành công việc". */
export class NotifyTaskCompleted1789344000000 implements MigrationInterface {
  name = 'NotifyTaskCompleted1789344000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // ADD VALUE chạy được trong transaction từ Postgres 12, miễn là giá trị mới
    // không được dùng ngay trong chính transaction đó — ở đây chỉ khai báo.
    await queryRunner.query(`
      ALTER TYPE "HRM"."notifications_type_enum" ADD VALUE IF NOT EXISTS 'TASK_COMPLETED'
    `);
  }

  async down(): Promise<void> {
    // Postgres không hỗ trợ bỏ một giá trị khỏi enum. Muốn lùi phải tạo type mới
    // rồi chuyển cột sang, không đáng cho một giá trị thừa vô hại.
  }
}
