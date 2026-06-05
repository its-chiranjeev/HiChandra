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

  @OneToOne(() => User, (user) => user.technicianProfile, { onDelete: 'CASCADE' })
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

  // Tools & Equipment

  @Column({ default: false })
  hasLadder!: boolean;

  @Column({ default: false })
  hasACGauges!: boolean;

  @Column({ default: false })
  hasSafetyEquipment!: boolean;

  @Column({ default: false })
  hasVehicle!: boolean;

  // Bank details

  @Column({ type: 'varchar', length: 100, nullable: true })
  accountHolderName?: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  accountNumber?: string;

  @Column({ type: 'varchar', length: 11, nullable: true })
  ifscCode?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  bankName?: string;

  @Column({ default: false })
  isVerified!: boolean;

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
