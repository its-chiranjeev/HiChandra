import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Service } from './service.entity';

@Entity('pricing_rules')
export class PricingRule {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ type: 'int' })
  serviceId!: number;

  @OneToOne(() => Service, (service) => service.pricingRule, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'serviceId' })
  service!: Service;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  serviceBasePrice!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  perHourRate!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  perKmRate!: number;

  @Column({ type: 'decimal', precision: 4, scale: 2, default: 1.0 })
  weekendMultiplier!: number;

  @Column({ type: 'decimal', precision: 4, scale: 2, default: 1.0 })
  peakHourMultiplier!: number;

  @Column({ type: 'jsonb', nullable: true })
  peakHours?: { start: number; end: number }[];

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  emergencyCharge!: number;

  @Column({ type: 'int', default: 5 })
  freeDistanceKm!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  distanceChargePerKm!: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  surgeFactor!: number;

  @Column({ type: 'boolean', default: false })
  isSurgeEnabled!: boolean;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  platformFee!: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  gst!: number;

  @Column({ type: 'boolean', default: false })
  isGstApplied!: boolean;

  @Column({ type: 'boolean', default: false })
  isDistanceKmApplied!: boolean;

  @Column({ type: 'boolean', default: false })
  isWeekendApplied!: boolean;

  @Column({ type: 'boolean', default: false })
  isPeakHourApplied!: boolean;

  @Column({ type: 'boolean', default: false })
  isEmergencyApplied!: boolean;

  @Column({ type: 'boolean', default: false })
  isPlatformFeeApplied!: boolean;

  @Column({ type: 'boolean', default: false })
  isPerHourRateApplied!: boolean;

  @Column({ type: 'boolean', default: true })
  isServiceBasePriceApplied!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
