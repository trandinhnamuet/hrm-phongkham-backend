import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAttendanceLogs1749046409000 implements MigrationInterface {
  name = 'CreateAttendanceLogs1749046409000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "HRM"."attendance_logs_status_enum"
        AS ENUM ('PRESENT', 'LATE', 'ABSENT', 'ON_LEAVE', 'HOLIDAY')
    `);

    await queryRunner.query(`
      CREATE TABLE "HRM"."attendance_logs" (
        "id"                    BIGSERIAL                               NOT NULL,
        "user_id"               UUID                                    NOT NULL,
        "work_date"             DATE                                    NOT NULL,
        "shift_id"              BIGINT                                  NULL,
        "check_in_at"           TIMESTAMPTZ                             NULL,
        "check_out_at"          TIMESTAMPTZ                             NULL,
        "check_in_lat"          NUMERIC(9, 6)                           NULL,
        "check_in_lng"          NUMERIC(9, 6)                           NULL,
        "check_in_distance_m"   INT                                     NULL,
        "check_in_valid"        BOOLEAN                                 NULL,
        "check_out_lat"         NUMERIC(9, 6)                           NULL,
        "check_out_lng"         NUMERIC(9, 6)                           NULL,
        "check_out_distance_m"  INT                                     NULL,
        "check_out_valid"       BOOLEAN                                 NULL,
        "status"  "HRM"."attendance_logs_status_enum"                   NOT NULL DEFAULT 'PRESENT',
        "late_minutes"          INT                                     NOT NULL DEFAULT 0,
        "worked_minutes"        INT                                     NOT NULL DEFAULT 0,
        "is_adjusted"           BOOLEAN                                 NOT NULL DEFAULT FALSE,
        "note"                  VARCHAR(255)                            NULL,
        "created_at"            TIMESTAMPTZ                             NOT NULL DEFAULT now(),
        "updated_at"            TIMESTAMPTZ                             NOT NULL DEFAULT now(),
        CONSTRAINT "PK_HRM_attendance_logs" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_HRM_attendance_user_date" UNIQUE ("user_id", "work_date"),
        CONSTRAINT "FK_HRM_attendance_logs_user"
          FOREIGN KEY ("user_id") REFERENCES "HRM"."users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_HRM_attendance_logs_shift"
          FOREIGN KEY ("shift_id") REFERENCES "HRM"."shifts"("id") ON DELETE SET NULL,
        CONSTRAINT "CHK_HRM_attendance_checkout"
          CHECK ("check_out_at" IS NULL OR "check_in_at" IS NULL OR "check_out_at" >= "check_in_at")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_HRM_attendance_user_date"
        ON "HRM"."attendance_logs" ("user_id", "work_date" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_HRM_attendance_date_status"
        ON "HRM"."attendance_logs" ("work_date", "status")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "HRM"."attendance_logs" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "HRM"."attendance_logs_status_enum"`);
  }
}
