import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { TechnicianProfile } from './technician-profile.entity';
import { Service } from './service.entity';

@Entity('technician_services')
export class TechnicianService {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  technicianProfileId!: number;

  @ManyToOne(() => TechnicianProfile, (profile) => profile.services, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'technicianProfileId' })
  technicianProfile?: TechnicianProfile;

  @Column({ type: 'int' })
  serviceId!: number;

  @ManyToOne(() => Service, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'serviceId' })
  service?: Service;

  @CreateDateColumn()
  createdAt!: Date;
}
