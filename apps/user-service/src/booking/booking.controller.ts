import { Body, Controller, Get, Param, ParseIntPipe, HttpCode, HttpStatus, Post, Req, UseGuards, ValidationPipe } from '@nestjs/common';
import { BookingService } from './booking.service';
import { JwtAuthGuard, Roles, RolesGuard } from '@hichandra/common';
import { CreateBookingDto } from '@hichandra/dtos';
import { USER_ROLE } from '@hichandra/entities';

@Controller('bookings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BookingController {
  constructor(private readonly bookingService: BookingService) { }

  @Post()
  @Roles(USER_ROLE.CUSTOMER)
  @HttpCode(HttpStatus.CREATED)
  async createBooking(
    @Req() req: any,
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: CreateBookingDto,
  ) {
    const booking = await this.bookingService.createBooking(req.user.id, dto);
    return {
      success: true,
      message: 'Booking created successfully',
      data: booking,
    };
  }

  @Get(':id')
  @Roles(USER_ROLE.CUSTOMER)
  @HttpCode(HttpStatus.OK)
  async getBooking(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const booking = await this.bookingService.getBooking(req.user.id, id);
    return {
      success: true,
      message: 'Booking fetched successfully',
      data: booking,
    };
  }

  @Post(':id/accept')
  @Roles(USER_ROLE.TECHNICIAN)
  @HttpCode(HttpStatus.OK)
  async acceptBooking(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const booking = await this.bookingService.acceptBooking(req.user.id, id);
    return {
      success: true,
      message: 'Booking accepted successfully',
      data: booking,
    };
  }
}
