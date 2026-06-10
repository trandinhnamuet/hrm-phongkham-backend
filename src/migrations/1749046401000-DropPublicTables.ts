import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Xóa toàn bộ tables đã tạo ở public schema (do synchronize: true trước đó).
 * Thứ tự DROP theo FK dependency (child trước, parent sau).
 */
export class DropPublicTables1749046401000 implements MigrationInterface {
  name = 'DropPublicTables1749046401000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Xóa child tables trước
    await queryRunner.query(`DROP TABLE IF EXISTS "public"."leave_requests" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "public"."leave_balances" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "public"."attendance_adjustments" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "public"."attendance_logs" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "public"."task_attachments" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "public"."task_comments" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "public"."tasks" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "public"."clinic_settings" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "public"."shifts" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "public"."leave_types" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "public"."users" CASCADE`);

    // Xóa enum types ở public schema
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."users_role_enum" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."users_status_enum" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."tasks_priority_enum" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."tasks_status_enum" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."attendance_logs_status_enum" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."attendance_adjustments_field_enum" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."attendance_adjustments_status_enum" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."leave_requests_status_enum" CASCADE`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Không thể khôi phục dữ liệu đã xóa — migration này là một chiều
    console.warn('DropPublicTables: down() không thể khôi phục các bảng đã xóa.');
  }
}
