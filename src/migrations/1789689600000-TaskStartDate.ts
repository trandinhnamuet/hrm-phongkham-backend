import { MigrationInterface, QueryRunner } from 'typeorm';

/** Công việc có thêm "Từ ngày" (ngày bắt đầu), không bắt buộc. */
export class TaskStartDate1789689600000 implements MigrationInterface {
  name = 'TaskStartDate1789689600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "HRM"."tasks" ADD COLUMN IF NOT EXISTS "start_date" DATE NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "HRM"."tasks" DROP COLUMN IF EXISTS "start_date"`);
  }
}
