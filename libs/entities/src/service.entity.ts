import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('services')
export class Service {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  categoryId!: number;         // FK → service_categories.id

  @Column({ type: 'varchar', length: 100 })
  name!: string;               // "AC General Service", "Gas Filling"

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  basePrice!: number;          // base price in INR

  @Column({ type: 'int', nullable: true })
  durationMinutes?: number;    // estimated job duration

  @Column({ default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
