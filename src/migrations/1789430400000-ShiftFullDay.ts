import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ca làm việc = giờ làm của CẢ NGÀY (buổi sáng + buổi chiều).
 *
 *  - shifts: thay start_time/end_time/break_minutes bằng 4 mốc giờ sáng/chiều.
 *    Nghỉ trưa chính là khoảng trống giữa hai buổi nên không cần cột riêng.
 *  - users.shift_id: gán ca cho từng nhân viên
 *  - attendance_logs: thêm early_leave_minutes / expected_minutes
 *  - tạo sẵn Ca 1 và Ca 2, ngừng dùng các ca nửa buổi cũ
 */
export class ShiftFullDay1789430400000 implements MigrationInterface {
  name = 'ShiftFullDay1789430400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    /* ── shifts: cấu trúc mới ─────────────────────────────── */
    await queryRunner.query(`
      ALTER TABLE "HRM"."shifts"
        ADD COLUMN IF NOT EXISTS "morning_start"   TIME,
        ADD COLUMN IF NOT EXISTS "morning_end"     TIME,
        ADD COLUMN IF NOT EXISTS "afternoon_start" TIME,
        ADD COLUMN IF NOT EXISTS "afternoon_end"   TIME
    `);

    // Chuyển dữ liệu cũ sang mô hình mới.
    await queryRunner.query(`
      UPDATE "HRM"."shifts"
         SET "morning_start" = "start_time",
             "morning_end"   = "end_time"
       WHERE "code" = 'MORNING' AND "morning_start" IS NULL
    `);
    await queryRunner.query(`
      UPDATE "HRM"."shifts"
         SET "afternoon_start" = "start_time",
             "afternoon_end"   = "end_time"
       WHERE "code" = 'AFTERNOON' AND "afternoon_start" IS NULL
    `);
    // Ca dài hơn 5 tiếng coi như cả ngày -> cắt đôi quanh giờ nghỉ.
    await queryRunner.query(`
      UPDATE "HRM"."shifts"
         SET "morning_start"   = "start_time",
             "morning_end"     = "start_time" + make_interval(mins => 240),
             "afternoon_start" = "start_time" + make_interval(mins => 240 + GREATEST("break_minutes", 0)),
             "afternoon_end"   = "end_time"
       WHERE "code" NOT IN ('MORNING', 'AFTERNOON')
         AND "morning_start" IS NULL
         AND "end_time" - "start_time" > make_interval(mins => 300 + GREATEST("break_minutes", 0))
    `);
    // Còn lại (ca ngắn) gộp hết vào buổi sáng.
    await queryRunner.query(`
      UPDATE "HRM"."shifts"
         SET "morning_start" = "start_time",
             "morning_end"   = "end_time"
       WHERE "morning_start" IS NULL AND "afternoon_start" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "HRM"."shifts"
        DROP COLUMN IF EXISTS "start_time",
        DROP COLUMN IF EXISTS "end_time",
        DROP COLUMN IF EXISTS "break_minutes"
    `);
    await queryRunner.query(
      `ALTER TABLE "HRM"."shifts" DROP CONSTRAINT IF EXISTS "CHK_HRM_shifts_break"`,
    );
    await queryRunner.query(
      `ALTER TABLE "HRM"."shifts" DROP CONSTRAINT IF EXISTS "CHK_HRM_shifts_sessions"`,
    );
    await queryRunner.query(`
      ALTER TABLE "HRM"."shifts"
        ADD CONSTRAINT "CHK_HRM_shifts_sessions" CHECK (
          ("morning_start"   IS NULL) = ("morning_end"   IS NULL)
          AND ("afternoon_start" IS NULL) = ("afternoon_end" IS NULL)
          AND ("morning_start" IS NOT NULL OR "afternoon_start" IS NOT NULL)
          AND ("morning_start"   IS NULL OR "morning_start"   < "morning_end")
          AND ("afternoon_start" IS NULL OR "afternoon_start" < "afternoon_end")
          AND ("morning_end" IS NULL OR "afternoon_start" IS NULL OR "morning_end" <= "afternoon_start")
        )
    `);

    /* ── 2 ca tạo sẵn ─────────────────────────────────────── */
    await queryRunner.query(`
      INSERT INTO "HRM"."shifts"
        ("code", "name", "morning_start", "morning_end", "afternoon_start", "afternoon_end", "grace_minutes", "is_active")
      VALUES
        ('CA_1', 'Ca 1', '07:00', '11:30', '14:00', '17:30', 5, TRUE),
        ('CA_2', 'Ca 2', '07:30', '11:30', '13:00', '18:00', 5, TRUE)
      ON CONFLICT ("code") DO NOTHING
    `);

    // Ca nửa buổi seed sẵn trước đây không còn hợp với mô hình cả ngày.
    // Ngừng dùng chứ không xoá: chấm công cũ còn trỏ tới shift_id của chúng.
    await queryRunner.query(`
      UPDATE "HRM"."shifts" SET "is_active" = FALSE
       WHERE "code" IN ('MORNING', 'AFTERNOON', 'FULL_DAY')
    `);

    /* ── users: gán ca ────────────────────────────────────── */
    await queryRunner.query(
      `ALTER TABLE "HRM"."users" ADD COLUMN IF NOT EXISTS "shift_id" BIGINT`,
    );
    await queryRunner.query(
      `ALTER TABLE "HRM"."users" DROP CONSTRAINT IF EXISTS "FK_HRM_users_shift"`,
    );
    await queryRunner.query(`
      ALTER TABLE "HRM"."users"
        ADD CONSTRAINT "FK_HRM_users_shift"
        FOREIGN KEY ("shift_id") REFERENCES "HRM"."shifts"("id") ON DELETE SET NULL
    `);
    // Mặc định mọi nhân viên làm theo Ca 1; Giám đốc đổi lại ở trang Nhân viên.
    await queryRunner.query(`
      UPDATE "HRM"."users"
         SET "shift_id" = (SELECT "id" FROM "HRM"."shifts" WHERE "code" = 'CA_1')
       WHERE "shift_id" IS NULL
    `);

    /* ── attendance_logs: chỉ số tính theo ca ─────────────── */
    await queryRunner.query(`
      ALTER TABLE "HRM"."attendance_logs"
        ADD COLUMN IF NOT EXISTS "early_leave_minutes" INT NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "expected_minutes"    INT NOT NULL DEFAULT 0
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "HRM"."attendance_logs"
        DROP COLUMN IF EXISTS "early_leave_minutes",
        DROP COLUMN IF EXISTS "expected_minutes"
    `);
    await queryRunner.query(
      `ALTER TABLE "HRM"."users" DROP CONSTRAINT IF EXISTS "FK_HRM_users_shift"`,
    );
    await queryRunner.query(`ALTER TABLE "HRM"."users" DROP COLUMN IF EXISTS "shift_id"`);

    await queryRunner.query(`DELETE FROM "HRM"."shifts" WHERE "code" IN ('CA_1', 'CA_2')`);
    await queryRunner.query(`
      UPDATE "HRM"."shifts" SET "is_active" = TRUE
       WHERE "code" IN ('MORNING', 'AFTERNOON', 'FULL_DAY')
    `);
    await queryRunner.query(
      `ALTER TABLE "HRM"."shifts" DROP CONSTRAINT IF EXISTS "CHK_HRM_shifts_sessions"`,
    );
    await queryRunner.query(`
      ALTER TABLE "HRM"."shifts"
        ADD COLUMN IF NOT EXISTS "start_time"    TIME,
        ADD COLUMN IF NOT EXISTS "end_time"      TIME,
        ADD COLUMN IF NOT EXISTS "break_minutes" SMALLINT NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      UPDATE "HRM"."shifts"
         SET "start_time" = COALESCE("morning_start", "afternoon_start"),
             "end_time"   = COALESCE("afternoon_end", "morning_end")
    `);
    await queryRunner.query(`
      ALTER TABLE "HRM"."shifts"
        ALTER COLUMN "start_time" SET NOT NULL,
        ALTER COLUMN "end_time"   SET NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "HRM"."shifts"
        DROP COLUMN IF EXISTS "morning_start",
        DROP COLUMN IF EXISTS "morning_end",
        DROP COLUMN IF EXISTS "afternoon_start",
        DROP COLUMN IF EXISTS "afternoon_end"
    `);
  }
}
