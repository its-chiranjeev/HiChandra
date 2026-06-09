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
import { User } from './user.entity';
import { Service } from './service.entity';
import { CustomerAddress } from './customer-address.entity';

export enum BOOKING_STATUS {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  ONGOING = 'ONGOING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

@Entity('bookings')
export class Booking {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ type: 'int' })
  customerId!: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customerId' })
  customer!: User;

  @Index()
  @Column({ type: 'int', nullable: true })
  technicianId?: number;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'technicianId' })
  technician?: User;

  @Column({ type: 'int' })
  serviceId!: number;

  @ManyToOne(() => Service)
  @JoinColumn({ name: 'serviceId' })
  service!: Service;

  @Column({ type: 'int' })
  addressId!: number;

  @ManyToOne(() => CustomerAddress)
  @JoinColumn({ name: 'addressId' })
  address!: CustomerAddress;

  @Column({ type: 'jsonb', nullable: true })
  serviceSpecifications?: Record<string, any>;

  @Column({ type: 'enum', enum: BOOKING_STATUS, default: BOOKING_STATUS.PENDING })
  status!: BOOKING_STATUS;

  @Column({ type: 'boolean', default: false })
  isEmergency!: boolean;

  @Column({ type: 'timestamp', nullable: true })
  scheduledAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  startedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt?: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  totalFare?: number;

  @Column({ type: 'jsonb', nullable: true })
  fareBreakdown?: {
    baseFare: number;
    distanceCharge: number;
    emergencyCharge: number;
    peakHourCharge: number;
    weekendCharge: number;
    surgeCharge: number;
    gst: number;
    platformFee: number;
    technicianEarning: number;
    platformEarning: number;
  };

  @Column({ type: 'text', nullable: true })
  cancellationReason?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
