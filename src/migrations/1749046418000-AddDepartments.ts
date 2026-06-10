import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDepartments1749046418000 implements MigrationInterface {
  name = 'AddDepartments1749046418000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "HRM"."departments" (
        "id"          BIGSERIAL PRIMARY KEY,
        "name"        VARCHAR(100) NOT NULL UNIQUE,
        "code"        VARCHAR(50)  NOT NULL UNIQUE,
        "description" VARCHAR(255),
        "is_active"   BOOLEAN NOT NULL DEFAULT true,
        "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "HRM"."users"
      ADD COLUMN IF NOT EXISTS "department_id" BIGINT
        REFERENCES "HRM"."departments"("id") ON DELETE SET NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "HRM"."users" DROP COLUMN IF EXISTS "department_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "HRM"."departments"`);
  }
}
