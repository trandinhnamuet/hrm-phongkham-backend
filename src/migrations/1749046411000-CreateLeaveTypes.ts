import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateLeaveTypes1749046411000 implements MigrationInterface {
  name = 'CreateLeaveTypes1749046411000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "HRM"."leave_types" (
        "id"               BIGSERIAL     NOT NULL,
        "code"             VARCHAR(30)   NOT NULL,
        "name"             VARCHAR(100)  NOT NULL,
        "deducts_balance"  BOOLEAN       NOT NULL DEFAULT TRUE,
        "max_days"         SMALLINT      NULL,
        "requires_doc"     BOOLEAN       NOT NULL DEFAULT FALSE,
        "is_paid"          BOOLEAN       NOT NULL DEFAULT TRUE,
        "is_active"        BOOLEAN       NOT NULL DEFAULT TRUE,
        CONSTRAINT "PK_HRM_leave_types"      PRIMARY KEY ("id"),
        CONSTRAINT "UQ_HRM_leave_types_code" UNIQUE ("code")
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "HRM"."leave_types" CASCADE`);
  }
}
