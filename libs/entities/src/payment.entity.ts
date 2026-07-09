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
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ type: 'int' })
  bookingId!: number;

  @ManyToOne(() => Booking, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bookingId' })
  booking!: Booking;

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
    type: 'enum', nullable:true,
    enum: USER_ROLE,
  })
  payBy!: USER_ROLE;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 100, nullable: true })
  paymentLinkId?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  paymentId?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  orderId?: string;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
