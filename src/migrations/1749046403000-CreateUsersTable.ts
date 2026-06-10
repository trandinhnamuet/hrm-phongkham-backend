import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsersTable1749046403000 implements MigrationInterface {
  name = 'CreateUsersTable1749046403000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "HRM"."users_role_enum" AS ENUM ('ADMIN', 'MANAGER', 'EMPLOYEE')
    `);

    await queryRunner.query(`
      CREATE TYPE "HRM"."users_status_enum" AS ENUM ('ACTIVE', 'RESIGNED')
    `);

    await queryRunner.query(`
      CREATE TABLE "HRM"."users" (
        "id"              UUID                        NOT NULL DEFAULT gen_random_uuid(),
        "employee_code"   VARCHAR(20)                 NOT NULL,
        "full_name"       VARCHAR(150)                NOT NULL,
        "email"           VARCHAR(255)                NOT NULL,
        "phone"           VARCHAR(20)                 NULL,
        "password_hash"   VARCHAR(255)                NOT NULL,
        "avatar_url"      TEXT                        NULL,
        "role"            "HRM"."users_role_enum"     NOT NULL DEFAULT 'EMPLOYEE',
        "position_title"  VARCHAR(100)                NULL,
        "join_date"       DATE                        NULL,
        "status"          "HRM"."users_status_enum"   NOT NULL DEFAULT 'ACTIVE',
        "last_login_at"   TIMESTAMPTZ                 NULL,
        "created_at"      TIMESTAMPTZ                 NOT NULL DEFAULT now(),
        "updated_at"      TIMESTAMPTZ                 NOT NULL DEFAULT now(),
        CONSTRAINT "PK_HRM_users" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_HRM_users_email" UNIQUE ("email"),
        CONSTRAINT "UQ_HRM_users_employee_code" UNIQUE ("employee_code")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_HRM_users_status" ON "HRM"."users" ("status")
      WHERE "status" = 'ACTIVE'
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "HRM"."users" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "HRM"."users_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "HRM"."users_role_enum"`);
  }
}
