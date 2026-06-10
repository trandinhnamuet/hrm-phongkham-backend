import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Department } from './entities/department.entity';
import { ClinicSettings } from './entities/clinic-settings.entity';
import { Task } from './entities/task.entity';
import { TaskComment } from './entities/task-comment.entity';
import { TaskAttachment } from './entities/task-attachment.entity';
import { Shift } from './entities/shift.entity';
import { AttendanceLog } from './entities/attendance-log.entity';
import { AttendanceAdjustment } from './entities/attendance-adjustment.entity';
import { LeaveType } from './entities/leave-type.entity';
import { LeaveBalance } from './entities/leave-balance.entity';
import { LeaveRequest } from './entities/leave-request.entity';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { DepartmentsModule } from './modules/departments/departments.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { LeaveModule } from './modules/leave/leave.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST'),
        port: +(config.get<string>('DB_PORT') || '5432'),
        username: config.get('DB_USERNAME'),
        password: config.get('DB_PASSWORD'),
        database: config.get('DB_NAME'),
        entities: [
          User, Department, ClinicSettings,
          Task, TaskComment, TaskAttachment,
          Shift, AttendanceLog, AttendanceAdjustment,
          LeaveType, LeaveBalance, LeaveRequest,
        ],
        migrations: [__dirname + '/migrations/*.{ts,js}'],
        migrationsRun: true,
        synchronize: false,
        ssl: { rejectUnauthorized: false },
        logging: false,
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    UsersModule,
    DepartmentsModule,
    TasksModule,
    AttendanceModule,
    LeaveModule,
  ],
})
export class AppModule {}
