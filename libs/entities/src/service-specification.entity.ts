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
import { Service } from './service.entity';

@Entity('service_specifications')
export class ServiceSpecification {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ type: 'int' })
  serviceId!: number;

  @ManyToOne(() => Service, (service) => service.specifications, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'serviceId' })
  service!: Service;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'enum', enum: ['text', 'select', 'multiselect', 'number', 'image'] })
  type!: string;

  @Column({ type: 'simple-json', nullable: true })
  values?: string[] | number[];

  @Column({ type: 'boolean', default: false })
  isRequired!: boolean;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
