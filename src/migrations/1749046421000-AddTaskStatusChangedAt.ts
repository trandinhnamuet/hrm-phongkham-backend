import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTaskStatusChangedAt1749046421000 implements MigrationInterface {
  name = 'AddTaskStatusChangedAt1749046421000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "HRM"."tasks" ADD COLUMN IF NOT EXISTS "status_changed_at" TIMESTAMPTZ
    `);
    // Backfill bằng thời điểm cập nhật gần nhất (xấp xỉ lần đổi trạng thái cuối cùng)
    await queryRunner.query(`
      UPDATE "HRM"."tasks"
      SET "status_changed_at" = COALESCE("updated_at", "created_at")
      WHERE "status_changed_at" IS NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "HRM"."tasks" DROP COLUMN IF EXISTS "status_changed_at"`);
  }
}
