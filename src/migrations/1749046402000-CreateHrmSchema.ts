import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tạo schema "HRM" — tất cả tables của hệ thống sẽ nằm trong schema này.
 */
export class CreateHRMSchema1749046402000 implements MigrationInterface {
  name = 'CreateHRMSchema1749046402000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "HRM"`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // CASCADE xóa toàn bộ objects trong schema
    await queryRunner.query(`DROP SCHEMA IF EXISTS "HRM" CASCADE`);
  }
}
