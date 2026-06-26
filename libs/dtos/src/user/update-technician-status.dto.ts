import { IsEnum } from 'class-validator';
import { TECHNICIAN_STATUS } from '@hichandra/entities';

export class UpdateTechnicianStatusDto {
  @IsEnum(TECHNICIAN_STATUS)
  status!: TECHNICIAN_STATUS;
}