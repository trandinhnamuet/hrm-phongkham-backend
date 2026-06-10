import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateClinicSettings1749046404000 implements MigrationInterface {
  name = 'CreateClinicSettings1749046404000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "HRM"."clinic_settings" (
        "id"           BIGSERIAL                   NOT NULL,
        "clinic_name"  VARCHAR(255)                NOT NULL,
        "gps_lat"      NUMERIC(9, 6)               NOT NULL,
        "gps_lng"      NUMERIC(9, 6)               NOT NULL,
        "gps_radius_m" INT                         NOT NULL DEFAULT 100,
        "updated_at"   TIMESTAMPTZ                 NOT NULL DEFAULT now(),
        CONSTRAINT "PK_HRM_clinic_settings" PRIMARY KEY ("id")
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "HRM"."clinic_settings"`);
  }
}
