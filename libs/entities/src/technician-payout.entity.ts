import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Booking } from './booking.entity';
import { Service } from './service.entity';
import { Payment } from './payment.entity';
import { PAYMENT_STATUS } from './payment.entity';

export enum TECHNICIAN_PAYOUT_STATUS {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  REVERSED = 'REVERSED',
}

@Entity('technician_payouts')
export class TechnicianPayout {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  bookingId!: number;

  @ManyToOne(() => Booking, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bookingId' })
  booking!: Booking;

  @Column()
  serviceId!: number;

  @ManyToOne(() => Service)
  @JoinColumn({ name: 'serviceId' })
  service!: Service;

  @Column()
  technicianId!: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'technicianId' })
  technician!: User;

  @Column()
  payoutBy!: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'payoutBy' })
  admin!: User;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
  })
  amount!: number;

  @Column({
    type: 'enum',
    enum: TECHNICIAN_PAYOUT_STATUS,
    default: TECHNICIAN_PAYOUT_STATUS.PENDING,
  })
  status!: TECHNICIAN_PAYOUT_STATUS;

  @Column({ nullable: true })
  paymentRecordId!: number;

  @ManyToOne(() => Payment)
  @JoinColumn({ name: 'paymentRecordId' })
  payment!: Payment;

  @Column({ nullable: true, unique: true })
  razorpayPayoutId?: string;

  @Column({ nullable: true, unique: true })
  idempotencyKey?: string;

  @Column({ nullable: true })
  utr?: string;

  @Column({ nullable: true })
  failureReason?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}