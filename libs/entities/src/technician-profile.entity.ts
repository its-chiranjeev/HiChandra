import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

export enum TECHNICIAN_STATUS {
  INCOMPLETE = 'INCOMPLETE',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  SUSPENDED = 'SUSPENDED',
}

@Entity('technician_profiles')
export class TechnicianProfile {

  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  userId!: number;                        // FK → users.id

  @OneToOne(() => User, (user) => user.technicianProfile)
  @JoinColumn({ name: 'userId' })
  user?: User;

  // Basic Info
  @Column({ type: 'varchar', length: 255, nullable: true })
  address?: string;

  @Column({ type: 'int', nullable: true })
  yearsOfExperience?: number;

  @Column({ type: 'simple-array', nullable: true })
  languages?: string[];                   // ["Hindi", "English"]

  @Column({
    type: 'enum',
    enum: TECHNICIAN_STATUS,
    default: TECHNICIAN_STATUS.INCOMPLETE,
  })
  status!: TECHNICIAN_STATUS;

  @Column({ type: 'text', nullable: true })
  rejectionReason?: string;

  // Availability
  @Column({ default: false })
  isAvailable!: boolean;

  @Column({ type: 'timestamp', nullable: true })
  lastSeenAt?: Date;

  // Live Location
  @Column({ type: 'decimal', precision: 10, scale: 8, nullable: true })
  currentLat?: number;

  @Column({ type: 'decimal', precision: 11, scale: 8, nullable: true })
  currentLng?: number;

  @Column({ type: 'timestamp', nullable: true })
  locationUpdatedAt?: Date;

  // Service Area
  @Column({ type: 'int', nullable: true })
  serviceRadiusKm?: number;

  @Column({ type: 'simple-array', nullable: true })
  preferredAreas?: string[];             // ["Lajpat Nagar", "CP"]

  @Column({ type: 'simple-array', nullable: true })
  pincodes?: string[];                   // ["110024", "110003"]

  // Timestamps
  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
