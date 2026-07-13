import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { TechnicianProfile } from './technician-profile.entity';

export enum TECHNICIAN_LOCATION_TYPE {
  WORK = 'WORK',
}

@Entity('technician_locations')
export class TechnicianLocation {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ type: 'int' })
  technicianId!: number;

  @ManyToOne(() => TechnicianProfile, (profile) => profile.locations, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'technicianId' })
  technicianProfile!: TechnicianProfile;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  latitude!: number;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  longitude!: number;

  @Column({ type: 'int' })
  serviceRadiusKm!: number;

  @Column({
    type: 'enum',
    enum: TECHNICIAN_LOCATION_TYPE,
    default: TECHNICIAN_LOCATION_TYPE.WORK,
  })
  type!: TECHNICIAN_LOCATION_TYPE;

  @Column({ type: 'varchar', length: 255, nullable: true })
  fullAddress?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  state?: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  pincode?: string;

  @Column({ type: 'boolean', default: false })
  isDefault!: boolean;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'decimal', precision: 10, scale: 8, nullable: true })
  currentLat?: number;

  @Column({ type: 'decimal', precision: 11, scale: 8, nullable: true })
  currentLng?: number;

  @Column({ type: 'timestamp', nullable: true })
  locationUpdatedAt?: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}