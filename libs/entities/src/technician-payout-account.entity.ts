import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';

export enum PAYOUT_ACCOUNT_TYPE {
  VPA = 'VPA',
  BANK_ACCOUNT = 'BANK_ACCOUNT',
}

export enum PAYOUT_ONBOARDING_STATUS {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  FAILED = 'FAILED',
}

@Entity('technician_payout_accounts')
export class TechnicianPayoutAccount {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({
    type: 'int',
  })
  technicianId!: number;

  @ManyToOne(() => User, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'technicianId',
  })
  technician!: User;

  /*
   * TECHNICIAN PAYOUT DETAILS
   */

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  upiId?: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  accountHolderName?: string;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  bankName?: string;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  accountNumber?: string;

  @Column({
    type: 'varchar',
    length: 11,
    nullable: true,
  })
  ifscCode?: string;

  /*
   * RAZORPAY DETAILS
   */

  @Column({
    type: 'enum',
    enum: PAYOUT_ACCOUNT_TYPE,
    nullable: true,
  })
  accountType?: PAYOUT_ACCOUNT_TYPE;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  razorpayContactId?: string;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  razorpayFundAccountId?: string;

  @Column({
    type: 'enum',
    enum: PAYOUT_ONBOARDING_STATUS,
    default: PAYOUT_ONBOARDING_STATUS.PENDING,
  })
  status!: PAYOUT_ONBOARDING_STATUS;

  @Column({
    type: 'boolean',
    default: false,
  })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}