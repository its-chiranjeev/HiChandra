import { IsArray, IsNumber } from 'class-validator';

export class UpdateTechnicianServicesDto {
  @IsArray()
  @IsNumber({}, { each: true })
  services!: number[];
}
