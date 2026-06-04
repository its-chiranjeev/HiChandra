import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { TechnicianProfile } from './technician-profile.entity';

export enum SKILL_LEVEL {
  BEGINNER = 'BEGINNER',
  INTERMEDIATE = 'INTERMEDIATE',
  EXPERT = 'EXPERT',
}

export enum SKILL_TYPE {
  SOLAR_CLEANING = 'SOLAR_CLEANING',
  AC_REPAIR = 'AC_REPAIR',
  AC_INSTALLATION = 'AC_INSTALLATION',
  AC_SERVICING = 'AC_SERVICING',
  CHIMNEY_CLEANING = 'CHIMNEY_CLEANING',
  GEYSER_REPAIR = 'GEYSER_REPAIR',
  RO_WATER_PURIFIER = 'RO_WATER_PURIFIER',
  WASHING_MACHINE_REPAIR = 'WASHING_MACHINE_REPAIR',
  REFRIGERATOR_REPAIR = 'REFRIGERATOR_REPAIR',
}

@Entity('technician_skills')
export class TechnicianSkill {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  technicianProfileId!: number;

  @ManyToOne(() => TechnicianProfile, (profile) => profile.skills, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'technicianProfileId' })
  technicianProfile?: TechnicianProfile;

  @Column({ type: 'int' })
  serviceId!: number;

  @Column({ type: 'enum', enum: SKILL_LEVEL })
  experienceLevel!: SKILL_LEVEL;

  @CreateDateColumn()
  createdAt!: Date;
}
