import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  OneToMany,
  DeleteDateColumn
} from 'typeorm';
import { PricingRule } from './pricing-rule.entity';
import { ServiceSpecification } from './service-specification.entity';

@Entity('services')
export class Service {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'varchar', nullable: true })
  iconUrl?: string;

  @OneToOne(() => PricingRule, (pricingRule) => pricingRule.service)
  pricingRule?: PricingRule;

  @OneToMany(() => ServiceSpecification, (spec) => spec.service)
  specifications?: ServiceSpecification[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}
