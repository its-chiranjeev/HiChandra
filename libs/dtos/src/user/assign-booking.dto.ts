import { IsInt, IsNotEmpty, Min, IsDate } from 'class-validator';
import { Type } from 'class-transformer';

export class AssignBookingDto {
    @IsNotEmpty()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    bookingId!: number;

    @IsNotEmpty()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    technicianId!: number;

    @Type(() => Date)
    @IsDate()
    @IsNotEmpty()
    scheduledAt!: Date;
}