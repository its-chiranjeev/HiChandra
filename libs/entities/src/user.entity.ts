import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  OneToMany,
  OneToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { TechnicianProfile } from './technician-profile.entity';
import { CustomerAddress } from './customer-address.entity';

export enum USER_ROLE {
  CUSTOMER = 'CUSTOMER',
  TECHNICIAN = 'TECHNICIAN',
  ADMIN = 'ADMIN',
}

export enum USER_STATUS {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  // REJECTED = 'REJECTED',
  BLOCKED = 'BLOCKED',
  PENDING = 'PENDING',
}

export enum AUTH_PORTAL_TYPE {
  HOME_PAGE = 'HOME_PAGE',
  ADMIN_PAGE = 'ADMIN_PAGE'
}

@Entity('users')
@Unique(['phone', 'countryCode'])
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  // Basic Info
  // @Index({ unique: true })
  // @Column({ type: 'varchar', length: 150 })
  // email!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 150, nullable: true })
  email?: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 100 })
  username!: string;

  @Column({ type: 'varchar', length: 5, nullable: true })
  countryCode?: string | null;

  @Column({ type: 'varchar', length: 15, nullable: true })
  phone?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  country?: string;

  @Column({ type: 'varchar', length: 15, nullable: true })
  emergencyContact?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  firstName?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  lastName?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  profileImage?: string;

  // Authentication
  @Column({ type: 'varchar', length: 255 })
  password!: string;

  @Column({ type: 'varchar', nullable: true })
  hashedRefreshToken?: string | null;

  @Column({ type: 'timestamp', nullable: true })
  lastLoginAt?: Date;

  @Column({ default: 1 })
  tokenVersion!: number;

  // Role & Status
  @Column({
    type: 'enum',
    enum: USER_ROLE,
    default: USER_ROLE.CUSTOMER,
  })
  role!: USER_ROLE;

  @Column({
    type: 'enum',
    enum: USER_STATUS,
    default: USER_STATUS.ACTIVE,
  })
  status!: USER_STATUS;

  @Column({ nullable: true })
  technicianProfileId?: number;

  @OneToOne(() => TechnicianProfile, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'technicianProfileId' })
  technicianProfile?: TechnicianProfile;

  @Column({ type: 'boolean', default: true })
  isTechnicianProfileCompleted!: boolean;

  // Timestamps
  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn()
  deletedAt?: Date;

  @OneToMany(() => CustomerAddress, (address) => address.user)
  addresses?: CustomerAddress[];

  @Column({
    type: 'decimal',
    precision: 3,
    scale: 2,
    nullable: true,
  })
  overallRating?: number | null;

  @Column({ type: 'int', nullable: true })
  paymentId?: number | null;

  @Column({ type: 'boolean', default: false })
  isTokenPaid!: boolean;
}