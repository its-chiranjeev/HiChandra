import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { TechnicianProfile } from './technician-profile.entity';

@Entity('technician_service_areas')
export class TechnicianServiceArea {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  technicianProfileId!: number;

  @ManyToOne(() => TechnicianProfile, (profile) => profile.serviceAreas, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'technicianProfileId' })
  technicianProfile?: TechnicianProfile;

  @Column({ type: 'varchar', length: 10 })
  pincode!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  areaName?: string;

  @CreateDateColumn()
  createdAt!: Date;
}
