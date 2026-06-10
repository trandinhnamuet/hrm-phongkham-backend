import {
  Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'clinic_settings', schema: 'HRM' })
export class ClinicSettings {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'clinic_name', length: 255 })
  clinicName: string;

  @Column({ name: 'gps_lat', type: 'decimal', precision: 9, scale: 6 })
  gpsLat: number;

  @Column({ name: 'gps_lng', type: 'decimal', precision: 9, scale: 6 })
  gpsLng: number;

  @Column({ name: 'gps_radius_m', type: 'int', default: 100 })
  gpsRadiusM: number;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
