import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { TechnicianProfile } from './technician-profile.entity';

@Entity('technician_brand_expertise')
export class TechnicianBrandExpertise {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  technicianProfileId!: number;

  @ManyToOne(() => TechnicianProfile, (profile) => profile.brandExpertise, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'technicianProfileId' })
  technicianProfile?: TechnicianProfile;

  @Column({ type: 'varchar', length: 100 })
  brandName!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
