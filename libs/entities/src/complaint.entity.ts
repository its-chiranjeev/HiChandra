import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User , USER_ROLE} from './user.entity';
import { Booking } from './booking.entity';

export enum COMPLAINT_STATUS {
  PENDING = 'PENDING',
  RESOLVED = 'RESOLVED',
}

@Entity('complaints')
export class Complaint {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ type: 'int', nullable: true })
  serviceId?: number | null;

  @Index()
  @Column({ type: 'int', nullable: true })
  bookingId?: number | null;

  @ManyToOne(() => Booking, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'bookingId' })
  booking?: Booking | null;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text' })
  description!: string;

  @Index()
  @Column({ type: 'int' })
  createdBy!: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'createdBy' })
  createdByUser!: User;

  @Column({
    type: 'enum',
    enum: USER_ROLE,
  })
  createdByRole!: USER_ROLE;

  @Column({
    type: 'enum',
    enum: COMPLAINT_STATUS,
    default: COMPLAINT_STATUS.PENDING,
  })
  status!: COMPLAINT_STATUS;

  @Column({ type: 'text', nullable: true })
  resolutionRemark?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}