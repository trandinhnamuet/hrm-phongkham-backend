import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Người giao việc đánh giá kết quả.
 *
 * Nhân viên chuyển công việc sang Hoàn thành -> chờ đánh giá.
 * Người giao chọn Đạt, hoặc Trả lại kèm góp ý để nhân viên làm lại.
 */
export class TaskReview1789171200000 implements MigrationInterface {
  name = 'TaskReview1789171200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "HRM"."tasks_review_status_enum"
          AS ENUM ('PENDING_REVIEW', 'ACCEPTED', 'RETURNED');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    await queryRunner.query(`
      ALTER TABLE "HRM"."tasks"
        ADD COLUMN IF NOT EXISTS "review_status" "HRM"."tasks_review_status_enum" NULL,
        ADD COLUMN IF NOT EXISTS "review_note"   TEXT        NULL,
        ADD COLUMN IF NOT EXISTS "reviewed_by"   UUID        NULL,
        ADD COLUMN IF NOT EXISTS "reviewed_at"   TIMESTAMPTZ NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "HRM"."tasks"
        DROP CONSTRAINT IF EXISTS "FK_HRM_tasks_reviewed_by"
    `);
    await queryRunner.query(`
      ALTER TABLE "HRM"."tasks"
        ADD CONSTRAINT "FK_HRM_tasks_reviewed_by"
        FOREIGN KEY ("reviewed_by") REFERENCES "HRM"."users"("id") ON DELETE SET NULL
    `);

    // Công việc đã Hoàn thành từ trước coi như đã được chấp nhận, để danh sách
    // chờ đánh giá không đột ngột phình ra toàn việc cũ.
    await queryRunner.query(`
      UPDATE "HRM"."tasks"
      SET "review_status" = 'ACCEPTED'
      WHERE "status" = 'DONE' AND "review_status" IS NULL AND "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_HRM_tasks_review_status"
        ON "HRM"."tasks" ("review_status") WHERE "deleted_at" IS NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "HRM"."IDX_HRM_tasks_review_status"`);
    await queryRunner.query(`
      ALTER TABLE "HRM"."tasks" DROP CONSTRAINT IF EXISTS "FK_HRM_tasks_reviewed_by"
    `);
    await queryRunner.query(`
      ALTER TABLE "HRM"."tasks"
        DROP COLUMN IF EXISTS "review_status",
        DROP COLUMN IF EXISTS "review_note",
        DROP COLUMN IF EXISTS "reviewed_by",
        DROP COLUMN IF EXISTS "reviewed_at"
    `);
    await queryRunner.query(`DROP TYPE IF EXISTS "HRM"."tasks_review_status_enum"`);
  }
}
