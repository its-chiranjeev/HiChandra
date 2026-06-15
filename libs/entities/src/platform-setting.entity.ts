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
