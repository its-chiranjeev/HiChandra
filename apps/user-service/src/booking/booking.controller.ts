import { Body, Controller, Get, Param, ParseIntPipe, HttpCode, Patch, HttpStatus, Query, Post, Req, Headers, UseGuards, ValidationPipe } from '@nestjs/common';
import { BookingService } from './booking.service';
import { JwtAuthGuard, Roles, RolesGuard } from '@hichandra/common';
import { StartBookingDto, CreateBookingDto, AssignBookingDto, CancelBookingDto, CreateComplaintDto, UpdateComplaintDto, UpdateBookingStatusDto, CreateTechnicianPayoutDto , RescheduleBookingDto , RepeatBookingDto , TechnicianCancelBookingDto, CreateBookingReviewDto } from '@hichandra/dtos';
import { USER_ROLE, BOOKING_STATUS, COMPLAINT_STATUS, PAYMENT_STATUS } from '@hichandra/entities';

@Controller('bookings')
export class BookingController {
  constructor(private readonly bookingService: BookingService) { }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
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
  @UseGuards(JwtAuthGuard, RolesGuard)
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

  @Post('payment/webhook')
  @HttpCode(HttpStatus.OK)
  async paymentWebhook(
    @Req() req: Request,
    @Headers('x-razorpay-signature')
    signature: string,
  ) {
    return this.bookingService.handlePaymentWebhook(
      req.body,
      signature,
    );
  }

  @Post('admin/payout')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(USER_ROLE.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async createTechnicianPayout(
    @Req() req: any,
    @Body(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    )
    dto: CreateTechnicianPayoutDto,
  ) {
    return this.bookingService.createTechnicianPayout(
      req.user.id,
      dto,
    );
  }


  
  @Get('all')
  @UseGuards(JwtAuthGuard, RolesGuard)
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
  @UseGuards(JwtAuthGuard, RolesGuard)
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
  
  // Reschedule Booking 
  @Patch('reschedule/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(USER_ROLE.CUSTOMER, USER_ROLE.ADMIN)
  @HttpCode(HttpStatus.OK)
  async rescheduleBooking(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: RescheduleBookingDto,
    @Req() req: any,
  ) {
    return this.bookingService.rescheduleBooking(id, dto, req.user);
  }
  
  //Complaint By ID
  @Get('admin/complaints/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(USER_ROLE.ADMIN)
  @HttpCode(HttpStatus.OK)
  async getComplaintById(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.bookingService.getComplaintById(id);
  }

  //get payment
  @Get('admin/payments')
  @UseGuards(JwtAuthGuard, RolesGuard)
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

  //Get Payments by ID
  @Get('admin/payments/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(USER_ROLE.ADMIN)
  @HttpCode(HttpStatus.OK)
  async getPaymentById(
      @Param('id', ParseIntPipe) id: number,
    ) {
      return this.bookingService.getPaymentById(id);
    }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(USER_ROLE.ADMIN)
  @HttpCode(HttpStatus.OK)
  async getBookingById(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.bookingService.getBookingById(id);
  }

  
  @Post(':id/accept')
  @UseGuards(JwtAuthGuard, RolesGuard)
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
  @UseGuards(JwtAuthGuard, RolesGuard)
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
  @UseGuards(JwtAuthGuard, RolesGuard)
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

  // Repeat booking
  @Post('repeat/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(USER_ROLE.CUSTOMER)
  async repeatBooking(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ValidationPipe()) dto: RepeatBookingDto,
    @Req() req: any,
  ) {
    return this.bookingService.repeatBooking(id, dto, req.user);
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

  // cancel booking--Technician 
  @Patch('technician/cancel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(USER_ROLE.TECHNICIAN)
  async technicianCancelBooking(
    @Body() dto: TechnicianCancelBookingDto,
    @Req() req: any,
  ) {
    return this.bookingService.technicianCancelBooking(dto, req.user);
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

  @Post('review')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createBookingReview(
    @Req() req: any,
    @Body(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    )
    dto: CreateBookingReviewDto,
  ) {
    return this.bookingService.createBookingReview(
      req.user,
      dto,
    );
  }

}
