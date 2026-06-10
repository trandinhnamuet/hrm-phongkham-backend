import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddShortHoursStatus1749046416000 implements MigrationInterface {
  name = 'AddShortHoursStatus1749046416000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "HRM"."attendance_logs_status_enum" ADD VALUE IF NOT EXISTS 'SHORT_HOURS'`,
    );
  }

  async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing individual enum values
  }
}
