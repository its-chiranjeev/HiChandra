import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('service_areas')
export class ServiceArea {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 10 })
  pincode!: string;            // "110024"

  @Column({ type: 'varchar', length: 100 })
  areaName!: string;           // "Lajpat Nagar"

  @Column({ type: 'varchar', length: 100 })
  city!: string;               // "Delhi"

  @Column({ default: true })
  isActive!: boolean;          // admin can disable an area

  @CreateDateColumn()
  createdAt!: Date;
}
