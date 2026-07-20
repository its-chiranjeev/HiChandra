import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { TechnicianService } from './technician-service.entity';
import { TechnicianBrandExpertise } from './technician-brand-expertise.entity';
import { TechnicianLocation } from './technician-location.entity';

export enum TECHNICIAN_STATUS {
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum JOB_STATUS {
  OFFLINE = 'OFFLINE',
  BUSY = 'BUSY',
  AVAILABLE = 'AVAILABLE',
}

@Entity('technician_profiles')
export class TechnicianProfile {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  userId!: number; // FK → users.id

  @OneToOne(() => User, (user) => user.technicianProfile, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user?: User;

  // Basic Info
  @Column({ type: 'int', nullable: true })
  yearsOfExperience?: number;

  @Column({ type: 'jsonb', nullable: true })
  languages?: string[];                   // ["Hindi", "English"]

  @Column({
    type: 'enum',
    enum: TECHNICIAN_STATUS,
    default: TECHNICIAN_STATUS.PENDING_APPROVAL,
  })
  status!: TECHNICIAN_STATUS;

  @Column({ type: 'text', nullable: true })
  rejectionReason?: string;

  @Column({
    type: 'enum',
    enum: JOB_STATUS,
    default: JOB_STATUS.OFFLINE,
  })
  jobStatus!: JOB_STATUS;

  @Column({ type: 'timestamp', nullable: true })
  lastSeenAt?: Date;

  // Documents

  @Column({ type: 'varchar', nullable: true })
  aadharUrl?: string;

  @Column({ type: 'varchar', nullable: true })
  panUrl?: string;

  @Column({ type: 'varchar', nullable: true })
  policeCertUrl?: string;

  @Column({ type: 'varchar', nullable: true })
  tradeLicenseUrl?: string;

  @Column({ type: 'varchar', nullable: true })
  selfieUrl?: string;

  @Column({ type: 'varchar', nullable: true })
  gst?: string;

  // Tools & Equipment

  @Column({ default: false })
  hasLadder!: boolean;

  @Column({ default: false })
  hasACGauges!: boolean;

  @Column({ default: false })
  hasSafetyEquipment!: boolean;

  @Column({ default: false })
  hasVehicle!: boolean;

  // Timestamps
  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToMany(() => TechnicianService, (service) => service.technicianProfile)
  services?: TechnicianService[];

  @OneToMany(() => TechnicianBrandExpertise, (brand) => brand.technicianProfile)
  brandExpertise?: TechnicianBrandExpertise[];

  @OneToMany(() => TechnicianLocation, (location) => location.technicianProfile)
  locations?: TechnicianLocation[];
}
