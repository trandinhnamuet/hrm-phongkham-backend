import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { config } from 'dotenv';
import { User, UserRole, UserStatus } from './entities/user.entity';
import { Department } from './entities/department.entity';
import { Shift } from './entities/shift.entity';
import { LeaveType } from './entities/leave-type.entity';
import { ClinicSettings } from './entities/clinic-settings.entity';

config();

const ds = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: +(process.env.DB_PORT || 5432),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false },
  synchronize: false,
  entities: [__dirname + '/entities/*.entity.{ts,js}'],
});

async function seed() {
  await ds.initialize();
  console.log('✅ Connected to database');

  // Drop old conflicting enum types (từ lần sync trước chưa hoàn chỉnh)
  const enumsToDrop = [
    'leave_requests_status_enum',
    'attendance_logs_status_enum',
    'attendance_adjustments_field_enum',
    'attendance_adjustments_status_enum',
    'tasks_status_enum',
    'tasks_priority_enum',
    'users_role_enum',
    'users_status_enum',
  ];
  for (const e of enumsToDrop) {
    await ds.query(`DROP TYPE IF EXISTS "${e}" CASCADE`).catch(() => {});
  }
  await ds.synchronize(false);
  console.log('✅ Schema synchronized');

  // Seed departments
  const deptRepo = ds.getRepository(Department);
  const deptData = [
    { code: 'AN_NINH',    name: 'Bộ phận An ninh',    description: 'Quản lý an ninh phòng khám' },
    { code: 'NHAN_SU',    name: 'Bộ phận Nhân sự',    description: 'Quản lý nhân sự và hành chính' },
    { code: 'CHUYEN_MON', name: 'Bộ phận Chuyên môn', description: 'Đội ngũ y tế và kỹ thuật' },
  ];
  for (const d of deptData) {
    const existing = await deptRepo.findOne({ where: { code: d.code } });
    if (!existing) await deptRepo.save(deptRepo.create(d));
  }
  console.log('✅ Departments seeded');

  const shiftRepo = ds.getRepository(Shift);
  const shiftData = [
    { code: 'MORNING', name: 'Ca sáng', startTime: '08:00', endTime: '12:00', breakMinutes: 0, graceMinutes: 5 },
    { code: 'AFTERNOON', name: 'Ca chiều', startTime: '13:00', endTime: '17:00', breakMinutes: 0, graceMinutes: 5 },
    { code: 'FULL_DAY', name: 'Cả ngày', startTime: '08:00', endTime: '17:00', breakMinutes: 60, graceMinutes: 5 },
  ];
  for (const s of shiftData) {
    const existing = await shiftRepo.findOne({ where: { code: s.code } });
    if (!existing) await shiftRepo.save(shiftRepo.create(s));
  }
  console.log('✅ Shifts seeded');

  const typeRepo = ds.getRepository(LeaveType);
  const typeData = [
    { code: 'MONTHLY_OFF', name: 'Nghỉ phép tháng', deductsBalance: true, requiresDoc: false, isPaid: true },
    { code: 'UNPAID', name: 'Nghỉ không lương', deductsBalance: false, requiresDoc: false, isPaid: false },
    { code: 'MARRIAGE', name: 'Nghỉ hiếu hỉ', deductsBalance: false, maxDays: 3, requiresDoc: true, isPaid: true },
    { code: 'FUNERAL', name: 'Nghỉ tang', deductsBalance: false, maxDays: 3, requiresDoc: false, isPaid: true },
    { code: 'MILITARY', name: 'Nghỉ khám quân sự', deductsBalance: false, requiresDoc: true, isPaid: true },
  ];
  for (const t of typeData) {
    const existing = await typeRepo.findOne({ where: { code: t.code } });
    if (!existing) await typeRepo.save(typeRepo.create(t));
  }
  console.log('✅ Leave types seeded');

  const settingsRepo = ds.getRepository(ClinicSettings);
  const settingsExists = await settingsRepo.findOne({ where: {} });
  if (!settingsExists) {
    await settingsRepo.save(settingsRepo.create({
      clinicName: 'Phòng Khám Nha Khoa',
      gpsLat: 10.7769,
      gpsLng: 106.7009,
      gpsRadiusM: 150,
    }));
  }
  console.log('✅ Clinic settings seeded');

  const userRepo = ds.getRepository(User);
  const adminExists = await userRepo.findOne({ where: { email: 'admin@phongkham.com' } });
  if (!adminExists) {
    const passwordHash = await bcrypt.hash('Admin@123', 10);
    const admin = userRepo.create({
      employeeCode: 'NV001',
      fullName: 'Quản Lý Chung',
      email: 'admin@phongkham.com',
      passwordHash,
      role: UserRole.GIAM_DOC,
      positionTitle: 'Giám đốc',
      status: UserStatus.ACTIVE,
    });
    await userRepo.save(admin);
  }
  console.log('✅ Admin user seeded (email: admin@phongkham.com / pass: Admin@123)');

  await ds.destroy();
  console.log('🎉 Seed completed!');
}

seed().catch(e => { console.error(e); process.exit(1); });
