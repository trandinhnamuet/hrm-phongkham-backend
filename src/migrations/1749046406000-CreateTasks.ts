import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTasks1749046406000 implements MigrationInterface {
  name = 'CreateTasks1749046406000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "HRM"."tasks_priority_enum" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT')
    `);

    await queryRunner.query(`
      CREATE TYPE "HRM"."tasks_status_enum" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED')
    `);

    await queryRunner.query(`
      CREATE TABLE "HRM"."tasks" (
        "id"           BIGSERIAL                       NOT NULL,
        "title"        VARCHAR(255)                    NOT NULL,
        "description"  TEXT                            NULL,
        "created_by"   UUID                            NOT NULL,
        "assignee_id"  UUID                            NULL,
        "priority"     "HRM"."tasks_priority_enum"     NOT NULL DEFAULT 'NORMAL',
        "status"       "HRM"."tasks_status_enum"       NOT NULL DEFAULT 'TODO',
        "due_date"     DATE                            NULL,
        "completed_at" TIMESTAMPTZ                     NULL,
        "created_at"   TIMESTAMPTZ                     NOT NULL DEFAULT now(),
        "updated_at"   TIMESTAMPTZ                     NOT NULL DEFAULT now(),
        "deleted_at"   TIMESTAMPTZ                     NULL,
        CONSTRAINT "PK_HRM_tasks" PRIMARY KEY ("id"),
        CONSTRAINT "FK_HRM_tasks_created_by"
          FOREIGN KEY ("created_by") REFERENCES "HRM"."users"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_HRM_tasks_assignee"
          FOREIGN KEY ("assignee_id") REFERENCES "HRM"."users"("id") ON DELETE SET NULL,
        CONSTRAINT "CHK_HRM_tasks_dates"
          CHECK ("due_date" IS NULL OR "completed_at" IS NULL OR "completed_at"::date <= "due_date" + INTERVAL '30 days')
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_HRM_tasks_assignee" ON "HRM"."tasks" ("assignee_id")
      WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_HRM_tasks_status" ON "HRM"."tasks" ("status")
      WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_HRM_tasks_due" ON "HRM"."tasks" ("due_date")
      WHERE "deleted_at" IS NULL AND "status" != 'DONE'
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "HRM"."tasks" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "HRM"."tasks_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "HRM"."tasks_priority_enum"`);
  }
}
