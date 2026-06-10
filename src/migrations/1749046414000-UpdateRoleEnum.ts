import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateRoleEnum1749046414000 implements MigrationInterface {
  name = 'UpdateRoleEnum1749046414000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Rename enum values: ADMIN → GIAM_DOC, MANAGER → QUAN_LY, EMPLOYEE → NHAN_VIEN
    await queryRunner.query(`ALTER TYPE "HRM"."users_role_enum" RENAME VALUE 'ADMIN' TO 'GIAM_DOC'`);
    await queryRunner.query(`ALTER TYPE "HRM"."users_role_enum" RENAME VALUE 'MANAGER' TO 'QUAN_LY'`);
    await queryRunner.query(`ALTER TYPE "HRM"."users_role_enum" RENAME VALUE 'EMPLOYEE' TO 'NHAN_VIEN'`);
    await queryRunner.query(`ALTER TABLE "HRM"."users" ALTER COLUMN "role" SET DEFAULT 'NHAN_VIEN'`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "HRM"."users_role_enum" RENAME VALUE 'GIAM_DOC' TO 'ADMIN'`);
    await queryRunner.query(`ALTER TYPE "HRM"."users_role_enum" RENAME VALUE 'QUAN_LY' TO 'MANAGER'`);
    await queryRunner.query(`ALTER TYPE "HRM"."users_role_enum" RENAME VALUE 'NHAN_VIEN' TO 'EMPLOYEE'`);
    await queryRunner.query(`ALTER TABLE "HRM"."users" ALTER COLUMN "role" SET DEFAULT 'EMPLOYEE'`);
  }
}
