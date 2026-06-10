import { DataSource } from 'typeorm';
import { config } from 'dotenv';

config();

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: +(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false },
  entities: ['src/entities/*.entity.ts'],
  migrations: ['src/migrations/*.ts'],
  logging: true,
  synchronize: false,
});
