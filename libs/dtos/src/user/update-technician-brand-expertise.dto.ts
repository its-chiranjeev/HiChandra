import { IsArray, IsString } from 'class-validator';

export class UpdateTechnicianBrandExpertiseDto {
  @IsArray()
  @IsString({ each: true })
  brands!: string[];
}
