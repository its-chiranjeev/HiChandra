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
import { User, USER_ROLE } from './user.entity';
import { Booking } from './booking.entity';

export enum PAYMENT_STATUS {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  REVERSED = 'REVERSED',
}

export enum PAYMENT_TYPE {
  BOOKING_PAYMENT = 'BOOKING_PAYMENT',           // Customer -> Admin for Booking
  TOKEN_PAYMENT = 'TOKEN_PAYMENT',               // Customer -> Admin for One-time Platform Fee
  TECHNICIAN_PAYOUT = 'TECHNICIAN_PAYOUT',       // Admin -> Technician Payout
  CUSTOMER_REFUND = 'CUSTOMER_REFUND',           // Admin -> Customer Refund
}

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ type: 'int', nullable: true })
  bookingId!: number | null;

  @ManyToOne(() => Booking, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'bookingId' })
  booking?: Booking | null;

  @Index()
  @Column({ type: 'int', nullable: true })
  customerId!: number | null;

  // @ManyToOne(() => User, { onDelete: 'CASCADE' })
  // @JoinColumn({ name: 'customerId' })
  // customer!: User;

  @ManyToOne(() => User, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  customer?: User | null;

  @Index()
  @Column({ type: 'int', nullable: true })
  technicianId?: number;

  @ManyToOne(() => User, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'technicianId' })
  technician?: User;

  @Index()
  @Column({ type: 'int', nullable: true })
  payoutBy?: number | null;

  @ManyToOne(() => User, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'payoutBy' })
  payoutByUser?: User | null;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount!: number;

  @Column({ type: 'varchar', length: 10, default: 'INR' })
  currency!: string;

  @Column({
    type: 'enum',
    enum: PAYMENT_STATUS,
    default: PAYMENT_STATUS.PENDING,
  })
  status!: PAYMENT_STATUS;

  @Column({
    type: 'enum', nullable: true,
    enum: USER_ROLE,
  })
  payBy!: USER_ROLE;

  @Index()
  @Column({
    type: 'enum',
    enum: PAYMENT_TYPE,
    nullable: true,
  })
  paymentType?: PAYMENT_TYPE;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 100, nullable: true })
  paymentLinkId?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  paymentId?: string;

  @Index()
  @Column({ type: 'varchar', length: 100, nullable: true })
  razorpayPayoutId?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  idempotencyKey?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  utr?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  orderId?: string;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
