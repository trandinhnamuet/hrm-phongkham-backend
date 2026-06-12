import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddManagerDepartments1749046420000 implements MigrationInterface {
  name = 'AddManagerDepartments1749046420000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "HRM"."manager_departments" (
        "manager_id"    UUID    NOT NULL,
        "department_id" BIGINT  NOT NULL,
        CONSTRAINT "PK_HRM_manager_departments" PRIMARY KEY ("manager_id", "department_id"),
        CONSTRAINT "FK_HRM_md_manager"
          FOREIGN KEY ("manager_id") REFERENCES "HRM"."users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_HRM_md_dept"
          FOREIGN KEY ("department_id") REFERENCES "HRM"."departments"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_HRM_md_manager" ON "HRM"."manager_departments" ("manager_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_HRM_md_dept" ON "HRM"."manager_departments" ("department_id")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "HRM"."manager_departments" CASCADE`);
  }
}
