import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateLeaveBalances1749046412000 implements MigrationInterface {
  name = 'CreateLeaveBalances1749046412000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "HRM"."leave_balances" (
        "id"             BIGSERIAL       NOT NULL,
        "user_id"        UUID            NOT NULL,
        "year"           SMALLINT        NOT NULL,
        "month"          SMALLINT        NOT NULL,
        "entitled_days"  NUMERIC(3, 1)   NOT NULL DEFAULT 4,
        "used_days"      NUMERIC(3, 1)   NOT NULL DEFAULT 0,
        "pending_days"   NUMERIC(3, 1)   NOT NULL DEFAULT 0,
        "updated_at"     TIMESTAMPTZ     NOT NULL DEFAULT now(),
        CONSTRAINT "PK_HRM_leave_balances"         PRIMARY KEY ("id"),
        CONSTRAINT "UQ_HRM_leave_balances_user_ym" UNIQUE ("user_id", "year", "month"),
        CONSTRAINT "FK_HRM_leave_balances_user"
          FOREIGN KEY ("user_id") REFERENCES "HRM"."users"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_HRM_leave_balances_month"
          CHECK ("month" BETWEEN 1 AND 12),
        CONSTRAINT "CHK_HRM_leave_balances_nonneg"
          CHECK (
            "entitled_days" >= 0 AND
            "used_days"     >= 0 AND
            "pending_days"  >= 0
          )
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_HRM_leave_balances_user"
        ON "HRM"."leave_balances" ("user_id", "year", "month")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "HRM"."leave_balances"`);
  }
}
