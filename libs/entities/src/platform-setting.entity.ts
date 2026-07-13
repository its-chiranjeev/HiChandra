import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum PLATFORM_SETTING_KEYS {
  PLATFORM_FEE = 'PLATFORM_FEE',
  GST = 'GST',
  CURRENCY = 'CURRENCY',
  MIN_BOOKING_AMOUNT = 'MIN_BOOKING_AMOUNT',
  MAX_BOOKING_DISTANCE_KM = 'MAX_BOOKING_DISTANCE_KM',
  CUSTOMER_CANCELLATION_FEE = 'CUSTOMER_CANCELLATION_FEE',
  TECHNICIAN_COMMISSION = 'TECHNICIAN_COMMISSION',
  EMERGENCY_BOOKING_CHARGE = 'EMERGENCY_BOOKING_CHARGE',
  SUPPORT_PHONE = 'SUPPORT_PHONE',
  SUPPORT_EMAIL = 'SUPPORT_EMAIL',
  CUSTOMER_TOKEN_AMOUNT = 'CUSTOMER_TOKEN_AMOUNT',
}

@Entity('platform_settings')
export class PlatformSetting {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ type: 'varchar', length: 100, unique: true })
  key!: string;

  @Column({ type: 'varchar', length: 255 })
  value!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
