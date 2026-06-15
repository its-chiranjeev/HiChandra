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

export interface PriceBreakdown {
  serviceBasePrice: number;
  distanceCharge: number;
  emergencyCharge: number;
  peakHourCharge: number;
  weekendCharge: number;
  surgeCharge: number;
  gst: number;
  platformFee: number;
  technicianEarning: number;
  platformEarning: number;
}

export enum BOOKING_STATUS {
  PENDING = 'PENDING', // booking created, finding technician
  ACCEPTED = 'ACCEPTED', // technician accepted
  ENROUTE = 'ENROUTE', // technician on the way
  ARRIVED = 'ARRIVED', // technician reached customer location
  ONGOING = 'ONGOING', // work started
  COMPLETED = 'COMPLETED', // work done
  CANCELLED = 'CANCELLED', // cancelled by technician
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

  @Index()
  @Column({ type: 'int', nullable: true })
  cancelledBy?: number;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'technicianId' })
  technician?: User;

  @Column({ type: 'int' })
  serviceId!: number;

  @ManyToOne(() => Service, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'serviceId' })
  service!: Service;

  @Column({ type: 'int' })
  addressId!: number;

  @ManyToOne(() => CustomerAddress)
  @JoinColumn({ name: 'addressId' })
  address!: CustomerAddress;

  @Column({ type: 'jsonb', nullable: true })
  serviceSpecifications?: Record<string, any>;

  @Column({
    type: 'enum',
    enum: BOOKING_STATUS,
    default: BOOKING_STATUS.PENDING,
  })
  status!: BOOKING_STATUS;

  @Column({ type: 'boolean', default: false })
  isEmergency!: boolean;

  @Column({ type: 'boolean', default: false })
  isManualAssign!: boolean;

  @Column({ type: 'timestamp', nullable: true })
  scheduledAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  startedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt?: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  totalAmount?: number;

  @Column({ type: 'jsonb', nullable: true })
  priceBreakdown?: PriceBreakdown;

  @Column({ type: 'text', nullable: true })
  cancellationReason?: string;

  @Column({ type: 'jsonb', nullable: true })
  filteredTechnicians!: number[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
