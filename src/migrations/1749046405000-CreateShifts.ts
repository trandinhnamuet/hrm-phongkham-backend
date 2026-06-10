import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateShifts1749046405000 implements MigrationInterface {
  name = 'CreateShifts1749046405000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "HRM"."shifts" (
        "id"             BIGSERIAL     NOT NULL,
        "code"           VARCHAR(30)   NOT NULL,
        "name"           VARCHAR(100)  NOT NULL,
        "start_time"     TIME          NOT NULL,
        "end_time"       TIME          NOT NULL,
        "break_minutes"  SMALLINT      NOT NULL DEFAULT 0,
        "grace_minutes"  SMALLINT      NOT NULL DEFAULT 5,
        "is_active"      BOOLEAN       NOT NULL DEFAULT TRUE,
        "created_at"     TIMESTAMPTZ   NOT NULL DEFAULT now(),
        CONSTRAINT "PK_HRM_shifts"      PRIMARY KEY ("id"),
        CONSTRAINT "UQ_HRM_shifts_code" UNIQUE ("code"),
        CONSTRAINT "CHK_HRM_shifts_grace" CHECK ("grace_minutes" >= 0),
        CONSTRAINT "CHK_HRM_shifts_break" CHECK ("break_minutes" >= 0)
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "HRM"."shifts"`);
  }
}
