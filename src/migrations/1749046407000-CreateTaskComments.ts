import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTaskComments1749046407000 implements MigrationInterface {
  name = 'CreateTaskComments1749046407000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "HRM"."task_comments" (
        "id"         BIGSERIAL     NOT NULL,
        "task_id"    BIGINT        NOT NULL,
        "user_id"    UUID          NOT NULL,
        "body"       TEXT          NOT NULL,
        "created_at" TIMESTAMPTZ   NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ   NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMPTZ   NULL,
        CONSTRAINT "PK_HRM_task_comments" PRIMARY KEY ("id"),
        CONSTRAINT "FK_HRM_task_comments_task"
          FOREIGN KEY ("task_id") REFERENCES "HRM"."tasks"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_HRM_task_comments_user"
          FOREIGN KEY ("user_id") REFERENCES "HRM"."users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_HRM_task_comments_task" ON "HRM"."task_comments" ("task_id", "created_at")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "HRM"."task_comments"`);
  }
}
