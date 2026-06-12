import { Body, Controller, Get, Param, Query, ParseIntPipe, HttpCode, HttpStatus, Post, Patch, Req, UseGuards, ValidationPipe } from '@nestjs/common';
import { BookingService } from './booking.service';
import { JwtAuthGuard, Roles, RolesGuard } from '@hichandra/common';
import { CreateBookingDto, UpdateBookingStatusDto, StartBookingDto } from '@hichandra/dtos';
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

  @Get(':bookingId/payment')
  @Roles(USER_ROLE.CUSTOMER)
  @HttpCode(HttpStatus.OK)
  async getPaymentUrl(
    @Req() req: any,
    @Param('bookingId', ParseIntPipe) bookingId: number,
  ) {
    const data = await this.bookingService.getPaymentUrl(req.user.id, bookingId);
    return {
      success: true,
      message: 'Payment URL generated successfully',
      data,
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

  @Patch(':id/status')
  @Roles(USER_ROLE.TECHNICIAN)
  @HttpCode(HttpStatus.OK)
  async updateBookingStatus(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: UpdateBookingStatusDto,
  ) {
    const booking = await this.bookingService.updateBookingStatus(req.user.id, id, dto);
    return {
      success: true,
      message: `Booking status updated to ${dto.status} successfully`,
      data: booking,
    };
  }

  @Post(':id/start')
  @Roles(USER_ROLE.TECHNICIAN)
  @HttpCode(HttpStatus.OK)
  async startBooking(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: StartBookingDto,
  ) {
    const booking = await this.bookingService.startBooking(req.user.id, id, dto);
    return {
      success: true,
      message: 'Booking started successfully',
      data: booking,
    };
  }
}
