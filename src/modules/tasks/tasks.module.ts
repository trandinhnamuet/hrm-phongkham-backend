import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Task } from '../../entities/task.entity';
import { TaskComment } from '../../entities/task-comment.entity';
import { TaskAttachment } from '../../entities/task-attachment.entity';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  imports: [TypeOrmModule.forFeature([Task, TaskComment, TaskAttachment])],
  controllers: [TasksController],
  providers: [TasksService],
})
export class TasksModule {}
