import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Đăng nhập bằng email HOẶC số điện thoại.
 *
 *  - users.email bỏ NOT NULL: nhân viên chỉ có số điện thoại vẫn tạo được.
 *  - users.phone: chuỗi rỗng -> NULL, chuẩn hoá về dạng 0xxxxxxxxx (bỏ khoảng
 *    trắng, dấu chấm, +84), và UNIQUE vì giờ nó là tên đăng nhập.
 *  - CHECK: phải có ít nhất một trong hai, không thì không đăng nhập được.
 */
export class LoginByPhone1789603200000 implements MigrationInterface {
  name = 'LoginByPhone1789603200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "HRM"."users" ALTER COLUMN "email" DROP NOT NULL`);

    // Cùng quy tắc với normalizePhone() trong common/utils/contact.ts.
    await queryRunner.query(`
      UPDATE "HRM"."users"
         SET "phone" = NULLIF(regexp_replace("phone", '[[:space:].()-]', '', 'g'), '')
       WHERE "phone" IS NOT NULL
    `);
    await queryRunner.query(`
      UPDATE "HRM"."users" SET "phone" = '0' || substr("phone", 4)
       WHERE "phone" LIKE '+84%'
    `);
    await queryRunner.query(`
      UPDATE "HRM"."users" SET "phone" = '0' || substr("phone", 3)
       WHERE "phone" LIKE '84%' AND length("phone") = 11
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_HRM_users_phone"
        ON "HRM"."users" ("phone") WHERE "phone" IS NOT NULL
    `);
    await queryRunner.query(
      `ALTER TABLE "HRM"."users" DROP CONSTRAINT IF EXISTS "CHK_HRM_users_login"`,
    );
    await queryRunner.query(`
      ALTER TABLE "HRM"."users"
        ADD CONSTRAINT "CHK_HRM_users_login" CHECK ("email" IS NOT NULL OR "phone" IS NOT NULL)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "HRM"."users" DROP CONSTRAINT IF EXISTS "CHK_HRM_users_login"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "HRM"."UQ_HRM_users_phone"`);
    // Mô hình cũ bắt buộc email: người chỉ có SĐT được gán email tạm theo SĐT.
    await queryRunner.query(`
      UPDATE "HRM"."users" SET "email" = "phone" || '@chua-co-email.local'
       WHERE "email" IS NULL
    `);
    await queryRunner.query(`ALTER TABLE "HRM"."users" ALTER COLUMN "email" SET NOT NULL`);
  }
}
