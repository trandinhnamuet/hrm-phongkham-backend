import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ca làm việc có số buổi tuỳ ý.
 *
 * Thay 4 cột cố định morning_start/end + afternoon_start/end bằng một cột
 * `sessions` (jsonb): [{ "name": "Buổi sáng", "start": "07:00:00", "end": "11:30:00" }, ...].
 * Nhờ vậy tạo được ca chỉ có một buổi (VD bán thời gian 17:00-19:00) hoặc ca 3 buổi.
 *
 * Thứ tự / chồng lấn giữa các buổi được kiểm ở service (normalizeSessions);
 * DB chỉ chặn trường hợp ca rỗng.
 */
export class ShiftSessions1789516800000 implements MigrationInterface {
  name = 'ShiftSessions1789516800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "HRM"."shifts"
        ADD COLUMN IF NOT EXISTS "sessions" JSONB NOT NULL DEFAULT '[]'::jsonb
    `);

    // Chuyển hai buổi sáng / chiều cũ sang danh sách buổi.
    await queryRunner.query(`
      UPDATE "HRM"."shifts"
         SET "sessions" =
               CASE WHEN "morning_start" IS NOT NULL THEN
                 jsonb_build_array(jsonb_build_object(
                   'name', 'Buổi sáng',
                   'start', to_char("morning_start", 'HH24:MI:SS'),
                   'end', to_char("morning_end", 'HH24:MI:SS')))
               ELSE '[]'::jsonb END
               ||
               CASE WHEN "afternoon_start" IS NOT NULL THEN
                 jsonb_build_array(jsonb_build_object(
                   'name', 'Buổi chiều',
                   'start', to_char("afternoon_start", 'HH24:MI:SS'),
                   'end', to_char("afternoon_end", 'HH24:MI:SS')))
               ELSE '[]'::jsonb END
       WHERE "sessions" = '[]'::jsonb
    `);

    await queryRunner.query(
      `ALTER TABLE "HRM"."shifts" DROP CONSTRAINT IF EXISTS "CHK_HRM_shifts_sessions"`,
    );
    await queryRunner.query(`
      ALTER TABLE "HRM"."shifts"
        DROP COLUMN IF EXISTS "morning_start",
        DROP COLUMN IF EXISTS "morning_end",
        DROP COLUMN IF EXISTS "afternoon_start",
        DROP COLUMN IF EXISTS "afternoon_end"
    `);
    await queryRunner.query(`
      ALTER TABLE "HRM"."shifts"
        ADD CONSTRAINT "CHK_HRM_shifts_sessions" CHECK (
          jsonb_typeof("sessions") = 'array' AND jsonb_array_length("sessions") >= 1
        )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "HRM"."shifts" DROP CONSTRAINT IF EXISTS "CHK_HRM_shifts_sessions"`,
    );
    await queryRunner.query(`
      ALTER TABLE "HRM"."shifts"
        ADD COLUMN IF NOT EXISTS "morning_start"   TIME,
        ADD COLUMN IF NOT EXISTS "morning_end"     TIME,
        ADD COLUMN IF NOT EXISTS "afternoon_start" TIME,
        ADD COLUMN IF NOT EXISTS "afternoon_end"   TIME
    `);
    // Mô hình cũ chỉ chứa được 2 buổi: buổi đầu -> sáng, buổi cuối -> chiều.
    // Ca có từ 3 buổi trở lên sẽ mất các buổi ở giữa.
    await queryRunner.query(`
      UPDATE "HRM"."shifts"
         SET "morning_start" = ("sessions" -> 0 ->> 'start')::time,
             "morning_end"   = ("sessions" -> 0 ->> 'end')::time
    `);
    await queryRunner.query(`
      UPDATE "HRM"."shifts"
         SET "afternoon_start" = ("sessions" -> -1 ->> 'start')::time,
             "afternoon_end"   = ("sessions" -> -1 ->> 'end')::time
       WHERE jsonb_array_length("sessions") >= 2
    `);
    await queryRunner.query(`ALTER TABLE "HRM"."shifts" DROP COLUMN IF EXISTS "sessions"`);
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
  }
}
