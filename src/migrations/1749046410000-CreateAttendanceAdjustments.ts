import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAttendanceAdjustments1749046410000 implements MigrationInterface {
  name = 'CreateAttendanceAdjustments1749046410000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "HRM"."attendance_adjustments_field_enum"
        AS ENUM ('CHECK_IN', 'CHECK_OUT', 'STATUS')
    `);

    await queryRunner.query(`
      CREATE TYPE "HRM"."attendance_adjustments_status_enum"
        AS ENUM ('PENDING', 'APPROVED', 'REJECTED')
    `);

    await queryRunner.query(`
      CREATE TABLE "HRM"."attendance_adjustments" (
        "id"               BIGSERIAL                                          NOT NULL,
        "log_id"           BIGINT                                             NOT NULL,
        "requested_by"     UUID                                               NOT NULL,
        "field"            "HRM"."attendance_adjustments_field_enum"          NOT NULL,
        "requested_value"  VARCHAR(50)                                        NOT NULL,
        "reason"           TEXT                                               NOT NULL,
        "status"           "HRM"."attendance_adjustments_status_enum"         NOT NULL DEFAULT 'PENDING',
        "reviewed_by"      UUID                                               NULL,
        "reviewed_at"      TIMESTAMPTZ                                        NULL,
        "review_note"      VARCHAR(255)                                       NULL,
        "created_at"       TIMESTAMPTZ                                        NOT NULL DEFAULT now(),
        CONSTRAINT "PK_HRM_attendance_adjustments" PRIMARY KEY ("id"),
        CONSTRAINT "FK_HRM_adj_log"
          FOREIGN KEY ("log_id") REFERENCES "HRM"."attendance_logs"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_HRM_adj_requested_by"
          FOREIGN KEY ("requested_by") REFERENCES "HRM"."users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_HRM_adj_reviewed_by"
          FOREIGN KEY ("reviewed_by") REFERENCES "HRM"."users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_HRM_adj_log" ON "HRM"."attendance_adjustments" ("log_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_HRM_adj_pending"
        ON "HRM"."attendance_adjustments" ("status")
        WHERE "status" = 'PENDING'
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "HRM"."attendance_adjustments" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "HRM"."attendance_adjustments_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "HRM"."attendance_adjustments_field_enum"`);
  }
}
