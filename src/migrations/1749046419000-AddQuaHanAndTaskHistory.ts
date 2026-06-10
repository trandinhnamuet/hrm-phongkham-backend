import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddQuaHanAndTaskHistory1749046419000 implements MigrationInterface {
  name = 'AddQuaHanAndTaskHistory1749046419000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add QUA_HAN to status enum (PostgreSQL 12+ supports this in a transaction)
    await queryRunner.query(`
      ALTER TYPE "HRM"."tasks_status_enum" ADD VALUE IF NOT EXISTS 'QUA_HAN'
    `);

    // Drop the overly-restrictive date check that blocks completing overdue tasks
    await queryRunner.query(`
      ALTER TABLE "HRM"."tasks" DROP CONSTRAINT IF EXISTS "CHK_HRM_tasks_dates"
    `);

    // Create task_histories table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "HRM"."task_histories" (
        id           BIGSERIAL    NOT NULL,
        task_id      BIGINT       NOT NULL,
        changed_by_id UUID        NULL,
        change_type  VARCHAR(50)  NOT NULL,
        field_name   VARCHAR(100) NULL,
        old_value    TEXT         NULL,
        new_value    TEXT         NULL,
        created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_HRM_task_histories" PRIMARY KEY (id),
        CONSTRAINT "FK_HRM_th_task"
          FOREIGN KEY (task_id) REFERENCES "HRM".tasks(id) ON DELETE CASCADE,
        CONSTRAINT "FK_HRM_th_user"
          FOREIGN KEY (changed_by_id) REFERENCES "HRM".users(id) ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_HRM_task_histories_task"
        ON "HRM".task_histories(task_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "HRM"."task_histories" CASCADE`);
  }
}
