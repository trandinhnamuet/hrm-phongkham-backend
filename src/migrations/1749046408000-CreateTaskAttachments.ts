import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTaskAttachments1749046408000 implements MigrationInterface {
  name = 'CreateTaskAttachments1749046408000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "HRM"."task_attachments" (
        "id"           BIGSERIAL     NOT NULL,
        "task_id"      BIGINT        NOT NULL,
        "uploaded_by"  UUID          NOT NULL,
        "file_name"    VARCHAR(255)  NOT NULL,
        "file_url"     TEXT          NOT NULL,
        "mime_type"    VARCHAR(100)  NULL,
        "size_bytes"   BIGINT        NULL,
        "created_at"   TIMESTAMPTZ   NOT NULL DEFAULT now(),
        CONSTRAINT "PK_HRM_task_attachments" PRIMARY KEY ("id"),
        CONSTRAINT "FK_HRM_task_attachments_task"
          FOREIGN KEY ("task_id") REFERENCES "HRM"."tasks"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_HRM_task_attachments_user"
          FOREIGN KEY ("uploaded_by") REFERENCES "HRM"."users"("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_HRM_task_attachments_task" ON "HRM"."task_attachments" ("task_id")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "HRM"."task_attachments"`);
  }
}
