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
    enum: PAYMENT_STATUS,
    default: PAYMENT_STATUS.PENDING,
  })
  status!: PAYMENT_STATUS;

  @Column()
  paymentRecordId!: number;

  @ManyToOne(() => Payment)
  @JoinColumn({ name: 'paymentRecordId' })
  payment!: Payment;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}