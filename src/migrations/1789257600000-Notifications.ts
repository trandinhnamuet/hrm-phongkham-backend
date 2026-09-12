import { MigrationInterface, QueryRunner } from 'typeorm';

/** Bảng thông báo trong app. */
export class Notifications1789257600000 implements MigrationInterface {
  name = 'Notifications1789257600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "HRM"."notifications_type_enum"
          AS ENUM ('TASK_ASSIGNED', 'TASK_COMMENT', 'TASK_REVIEWED', 'LEAVE_REVIEWED');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "HRM"."notifications" (
        "id"         BIGSERIAL                         NOT NULL,
        "user_id"    UUID                              NOT NULL,
        "type"       "HRM"."notifications_type_enum"   NOT NULL,
        "title"      VARCHAR(200)                      NOT NULL,
        "body"       TEXT                              NULL,
        "link"       VARCHAR(255)                      NULL,
        "actor_id"   UUID                              NULL,
        "is_read"    BOOLEAN                           NOT NULL DEFAULT false,
        "created_at" TIMESTAMPTZ                       NOT NULL DEFAULT now(),
        CONSTRAINT "PK_HRM_notifications" PRIMARY KEY ("id"),
        CONSTRAINT "FK_HRM_notifications_user"
          FOREIGN KEY ("user_id") REFERENCES "HRM"."users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_HRM_notifications_actor"
          FOREIGN KEY ("actor_id") REFERENCES "HRM"."users"("id") ON DELETE SET NULL
      )
    `);

    // Truy vấn chính là "thông báo của tôi, chưa đọc, mới nhất trước".
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_HRM_notifications_user_read_created"
        ON "HRM"."notifications" ("user_id", "is_read", "created_at" DESC)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "HRM"."notifications" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "HRM"."notifications_type_enum"`);
  }
}
