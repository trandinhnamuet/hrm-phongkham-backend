import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateLeaveRequests1749046413000 implements MigrationInterface {
  name = 'CreateLeaveRequests1749046413000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "HRM"."leave_requests_status_enum"
        AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')
    `);

    await queryRunner.query(`
      CREATE TABLE "HRM"."leave_requests" (
        "id"              BIGSERIAL                             NOT NULL,
        "user_id"         UUID                                  NOT NULL,
        "leave_type_id"   BIGINT                                NOT NULL,
        "start_date"      DATE                                  NOT NULL,
        "end_date"        DATE                                  NOT NULL,
        "total_days"      NUMERIC(3, 1)                         NOT NULL,
        "reason"          TEXT                                  NOT NULL,
        "attachment_url"  TEXT                                  NULL,
        "status"          "HRM"."leave_requests_status_enum"    NOT NULL DEFAULT 'PENDING',
        "reviewed_by"     UUID                                  NULL,
        "reviewed_at"     TIMESTAMPTZ                           NULL,
        "review_note"     VARCHAR(255)                          NULL,
        "created_at"      TIMESTAMPTZ                           NOT NULL DEFAULT now(),
        "updated_at"      TIMESTAMPTZ                           NOT NULL DEFAULT now(),
        "deleted_at"      TIMESTAMPTZ                           NULL,
        CONSTRAINT "PK_HRM_leave_requests" PRIMARY KEY ("id"),
        CONSTRAINT "FK_HRM_leave_requests_user"
          FOREIGN KEY ("user_id") REFERENCES "HRM"."users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_HRM_leave_requests_type"
          FOREIGN KEY ("leave_type_id") REFERENCES "HRM"."leave_types"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_HRM_leave_requests_reviewer"
          FOREIGN KEY ("reviewed_by") REFERENCES "HRM"."users"("id") ON DELETE SET NULL,
        CONSTRAINT "CHK_HRM_leave_requests_dates"
          CHECK ("end_date" >= "start_date"),
        CONSTRAINT "CHK_HRM_leave_requests_days"
          CHECK ("total_days" > 0)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_HRM_leave_requests_user"
        ON "HRM"."leave_requests" ("user_id", "start_date" DESC)
        WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_HRM_leave_requests_pending"
        ON "HRM"."leave_requests" ("status")
        WHERE "deleted_at" IS NULL AND "status" = 'PENDING'
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_HRM_leave_requests_daterange"
        ON "HRM"."leave_requests" ("start_date", "end_date")
        WHERE "status" IN ('PENDING', 'APPROVED')
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "HRM"."leave_requests" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "HRM"."leave_requests_status_enum"`);
  }
}
