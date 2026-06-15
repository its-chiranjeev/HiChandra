import { Body, Controller, Get, Param, ParseIntPipe, HttpCode, Patch, HttpStatus, Query, Post, Req, UseGuards, ValidationPipe } from '@nestjs/common';
import { BookingService } from './booking.service';
import { JwtAuthGuard, Roles, RolesGuard } from '@hichandra/common';
import { StartBookingDto, CreateBookingDto, AssignBookingDto, CancelBookingDto, CreateComplaintDto, UpdateComplaintDto, UpdateBookingStatusDto } from '@hichandra/dtos';
import { USER_ROLE, BOOKING_STATUS, COMPLAINT_STATUS, PAYMENT_STATUS } from '@hichandra/entities';

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
    const data = await this.bookingService.getPaymentUrl(
      req.user.id,
      bookingId,
    );
    return {
      success: true,
      message: 'Payment URL generated successfully',
      data,
    };
  }

  @Get('all')
  @Roles(USER_ROLE.ADMIN)
  @HttpCode(HttpStatus.OK)
  async getAllBookings(
    @Req() req: any,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('status') status?: BOOKING_STATUS,
  ) {
    console.log(req.user);
    return this.bookingService.getAllBookings(
      Number(page),
      Number(limit),
      status,
    );
  }
  //complaint api
  @Get('admin/complaints')
  @Roles(USER_ROLE.ADMIN)
  @HttpCode(HttpStatus.OK)
  async getAllComplaints(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('status') status?: COMPLAINT_STATUS,
  ) {
    return this.bookingService.getAllComplaints(
      Number(page),
      Number(limit),
      status,
    );
  }
  //get payment
  @Get('admin/payments')
  @Roles(USER_ROLE.ADMIN)
  @HttpCode(HttpStatus.OK)
  async getAllPayments(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('status') status?: PAYMENT_STATUS,
  ) {
    return this.bookingService.getAllPayments(
      Number(page),
      Number(limit),
      status,
    );
  }

  @Get(':id')
  @Roles(USER_ROLE.CUSTOMER)
  @HttpCode(HttpStatus.OK)
  async getBooking(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    const booking = await this.bookingService.getBooking(req.user.id, id);
    return {
      success: true,
      message: 'Booking fetched successfully',
      data: booking,
    };
  }

  @Get('admin/:id')
  @Roles(USER_ROLE.ADMIN)
  @HttpCode(HttpStatus.OK)
  async getBookingById(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.bookingService.getBookingById(id);
  }

  @Post(':id/accept')
  @Roles(USER_ROLE.TECHNICIAN)
  @HttpCode(HttpStatus.OK)
  async acceptBooking(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
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
    const booking = await this.bookingService.updateBookingStatus(
      req.user.id,
      id,
      dto,
    );
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
    const booking = await this.bookingService.startBooking(
      req.user.id,
      id,
      dto,
    );
    return {
      success: true,
      message: 'Booking started successfully',
      data: booking,
    };
  }
  @Post('admin/assign-booking')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(USER_ROLE.ADMIN)
  @HttpCode(HttpStatus.OK)
  async assignBookingManually(
    @Body(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    )
    dto: AssignBookingDto,
  ) {
    return this.bookingService.assignBookingManually(
      dto,
    );
  }

  @Patch('customer/cancel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(USER_ROLE.CUSTOMER)
  @HttpCode(HttpStatus.OK)
  async cancelBooking(
    @Req() req: any,
    @Body(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    )
    dto: CancelBookingDto,
  ) {
    return this.bookingService.cancelBooking(
      req.user.id,
      dto,
    );
  }
  //create complaint
  @Post('complaint')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async createComplaint(
    @Req() req: any,
    @Body(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    )
    dto: CreateComplaintDto,
  ) {
    return this.bookingService.createComplaint(
      req.user,
      dto,
    );
  }
  //edit complaint
  @Patch('complaint/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async updateComplaint(
    @Req() req: any,
    @Param('id', ParseIntPipe) complaintId: number,
    @Body(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    )
    dto: UpdateComplaintDto,
  ) {
    return this.bookingService.updateComplaint(
      req.user,
      complaintId,
      dto,
    );
  }



}
