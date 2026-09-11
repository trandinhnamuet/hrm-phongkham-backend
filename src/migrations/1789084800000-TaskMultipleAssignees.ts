import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Một công việc có thể giao cho nhiều người.
 *
 * Thay cột tasks.assignee_id (1 người) bằng bảng nối HRM.task_assignees (n người).
 * Dữ liệu cũ được chuyển sang bảng nối TRƯỚC khi bỏ cột, nên không mất gì.
 */
export class TaskMultipleAssignees1789084800000 implements MigrationInterface {
  name = 'TaskMultipleAssignees1789084800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "HRM"."task_assignees" (
        "task_id" BIGINT NOT NULL,
        "user_id" UUID   NOT NULL,
        CONSTRAINT "PK_HRM_task_assignees" PRIMARY KEY ("task_id", "user_id"),
        CONSTRAINT "FK_HRM_ta_task"
          FOREIGN KEY ("task_id") REFERENCES "HRM"."tasks"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_HRM_ta_user"
          FOREIGN KEY ("user_id") REFERENCES "HRM"."users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_HRM_ta_task" ON "HRM"."task_assignees" ("task_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_HRM_ta_user" ON "HRM"."task_assignees" ("user_id")
    `);

    // Chuyển người được giao hiện tại sang bảng nối trước khi bỏ cột.
    await queryRunner.query(`
      INSERT INTO "HRM"."task_assignees" ("task_id", "user_id")
      SELECT "id", "assignee_id"
      FROM "HRM"."tasks"
      WHERE "assignee_id" IS NOT NULL
      ON CONFLICT DO NOTHING
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS "HRM"."IDX_HRM_tasks_assignee"`);
    await queryRunner.query(`
      ALTER TABLE "HRM"."tasks" DROP CONSTRAINT IF EXISTS "FK_HRM_tasks_assignee"
    `);
    await queryRunner.query(`
      ALTER TABLE "HRM"."tasks" DROP COLUMN IF EXISTS "assignee_id"
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "HRM"."tasks" ADD COLUMN IF NOT EXISTS "assignee_id" UUID NULL
    `);

    // Một cột chỉ giữ được 1 người: lấy người đầu tiên theo user_id.
    // Các người được giao còn lại của cùng một task sẽ mất khi rollback.
    await queryRunner.query(`
      UPDATE "HRM"."tasks" t
      SET "assignee_id" = (
        SELECT ta."user_id"
        FROM "HRM"."task_assignees" ta
        WHERE ta."task_id" = t."id"
        ORDER BY ta."user_id"
        LIMIT 1
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "HRM"."tasks" ADD CONSTRAINT "FK_HRM_tasks_assignee"
        FOREIGN KEY ("assignee_id") REFERENCES "HRM"."users"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_HRM_tasks_assignee" ON "HRM"."tasks" ("assignee_id")
      WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS "HRM"."task_assignees" CASCADE`);
  }
}
