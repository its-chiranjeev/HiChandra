import { Body, Controller, Get, Param, ParseIntPipe, HttpCode, Patch, HttpStatus, Query, Post, Req, Headers, UseGuards, ValidationPipe, Delete, StreamableFile } from '@nestjs/common';
import { BookingService } from './booking.service';
import { JwtAuthGuard, Roles, RolesGuard } from '@hichandra/common';
import { StartBookingDto, CreateBookingDto, AssignBookingDto, CancelBookingDto, CreateComplaintDto, UpdateComplaintDto, UpdateBookingStatusDto, CreateTechnicianPayoutDto, RescheduleBookingDto, RepeatBookingDto, TechnicianCancelBookingDto, CreateBookingReviewDto, AdminCreateBookingDto, AdminUpdateBookingReviewDto, AdminCreatePayoutDto } from '@hichandra/dtos';
import { USER_ROLE, BOOKING_STATUS, COMPLAINT_STATUS, PAYMENT_STATUS, User, REVIEW_STATUS, PAYMENT_TYPE, BOOKING_PAYMENT_STATUS } from '@hichandra/entities';
import type { Request } from 'express';
import { PaymentService } from '@hichandra/payment';

interface AuthenticatedRequest extends Request {
  user: User;
}

@Controller('bookings')
export class BookingController {
  constructor(
    private readonly bookingService: BookingService,
    private readonly paymentService: PaymentService,
  ) { }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(USER_ROLE.CUSTOMER)
  @HttpCode(HttpStatus.CREATED)
  async createBooking(
    @Req() req: any,
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: CreateBookingDto,
  ) {
    const booking = await this.bookingService.createBooking(req.user.id, dto, req.user.role);
    return {
      success: true,
      message: 'Booking created successfully',
      data: booking,
    };
  }

  @Post('admin/create')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(USER_ROLE.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async adminCreateBooking(
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: AdminCreateBookingDto,
  ) {
    const booking = await this.bookingService.adminCreateBooking(dto);
    return {
      success: true,
      message: 'Booking created successfully by Admin',
      data: booking,
    };
  }

  @Get(':bookingId/payment')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(USER_ROLE.CUSTOMER, USER_ROLE.TECHNICIAN)
  @HttpCode(HttpStatus.OK)
  async getPaymentUrl(
    @Req() req: any,
    @Param('bookingId', ParseIntPipe) bookingId: number,
    @Query('redirectUrl') redirectUrl?: string,
  ) {
    const data = await this.bookingService.getPaymentUrl(
      req.user.id,
      bookingId,
      redirectUrl,
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

  @Post('admin/payout/manual')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(USER_ROLE.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async recordManualPayout(
    @Req() req: any,
    @Body(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    )
    dto: AdminCreatePayoutDto,
  ) {
    return this.bookingService.adminRecordTechnicianPayout(
      req.user.id,
      dto,
    );
  }

  @Get(':bookingId/invoice')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(USER_ROLE.CUSTOMER)
  async downloadInvoice(
    @Req() req: AuthenticatedRequest,
    @Param('bookingId', ParseIntPipe) bookingId: number,
  ): Promise<StreamableFile> {
    return this.paymentService.generateInvoicePdf(
      req.user,
      bookingId,
    );
  }

  //Get All booking For Admin And My Booking For User 
  @Get('all')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getAllBookings(
    @Req() req: any,
    @Query('page') page = '1',
    @Query('limit') limit = '10',
    @Query('status') status?: BOOKING_STATUS,
    @Query('sortById') sortById?: string,
    @Query('sortByUpdatedAt') sortByUpdatedAt?: string,
    @Query('sortByCreatedAt') sortByCreatedAt?: string,
    @Query('reviewStatus') reviewStatus?: REVIEW_STATUS,
    @Query('technicianPayoutStatus') technicianPayoutStatus?: BOOKING_PAYMENT_STATUS,
    @Query('bookingPaymentStatus') bookingPaymentStatus?: BOOKING_PAYMENT_STATUS,
  ) {
    return this.bookingService.getAllBookings(
      req.user,
      Number(page),
      Number(limit),
      status,
      sortById,
      sortByUpdatedAt,
      sortByCreatedAt,
      reviewStatus,
      technicianPayoutStatus,
      bookingPaymentStatus,
    );
  }

  //complaint api
  @Get('complaints')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(USER_ROLE.ADMIN, USER_ROLE.CUSTOMER, USER_ROLE.TECHNICIAN)
  @HttpCode(HttpStatus.OK)
  async getAllComplaints(
    @Req() req: any,
    @Query('page') page = '1',
    @Query('limit') limit = '10',
    @Query('status') status?: COMPLAINT_STATUS,
  ) {
    return this.bookingService.getAllComplaints(
      req.user,
      Number(page),
      Number(limit),
      status,
    );
  }

  // Get Complaint by ID
  @Get('complaint/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(USER_ROLE.ADMIN, USER_ROLE.CUSTOMER, USER_ROLE.TECHNICIAN)
  @HttpCode(HttpStatus.OK)
  async getComplaintById(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.bookingService.getComplaintById(id, req.user);
  }

  // @Get('my-bookings')
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(USER_ROLE.CUSTOMER, USER_ROLE.TECHNICIAN)
  // async getMyBookings(
  //   @Req() req: any,
  //   @Query('page') page = 1,
  //   @Query('limit') limit = 10,
  //   @Query('status') status?: BOOKING_STATUS,
  // ) {
  //   return this.bookingService.getMyBookings(
  //     req.user,
  //     Number(page),
  //     Number(limit),
  //     status,
  //   );
  // }

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

  //get payment
  @Get('payments/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(USER_ROLE.ADMIN, USER_ROLE.TECHNICIAN, USER_ROLE.CUSTOMER)
  @HttpCode(HttpStatus.OK)
  async getAllPayments(
    @Req() req: any,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('status') status?: PAYMENT_STATUS,
    @Query('paymentType') paymentType?: PAYMENT_TYPE,
  ) {
    return this.bookingService.getAllPayments(
      req.user,
      Number(page),
      Number(limit),
      status,
      paymentType,
    );
  }

  // Public API for fetching reviews (No Auth required)
  @Get('public/reviews')
  @HttpCode(HttpStatus.OK)
  async getPublicReviews(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('reviewStatus') reviewStatus?: REVIEW_STATUS,
    @Query('serviceId') serviceId?: string,
  ) {
    return this.bookingService.getPublicReviews(
      Number(page),
      Number(limit),
      reviewStatus,
      serviceId ? Number(serviceId) : undefined,
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

  @Get('payments/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(USER_ROLE.ADMIN, USER_ROLE.TECHNICIAN, USER_ROLE.CUSTOMER)
  @HttpCode(HttpStatus.OK)
  async getPaymentByIdGeneral(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.bookingService.getPaymentById(id, req.user);
  }

  // Admin: Update booking ratings, reviews, and review status
  @Patch('admin/review/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(USER_ROLE.ADMIN)
  @HttpCode(HttpStatus.OK)
  async adminUpdateBookingReview(
    @Param('id', ParseIntPipe) id: number,
    @Body(ValidationPipe) dto: AdminUpdateBookingReviewDto,
  ) {
    return this.bookingService.adminUpdateBookingReview(id, dto);
  }

  //My-Reviews For Users
  @Get('my-reviews')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getMyReviews(
    @Req() req: any,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    return this.bookingService.getMyReviews(
      req.user,
      Number(page),
      Number(limit),
    );
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(USER_ROLE.CUSTOMER)
  @HttpCode(HttpStatus.OK)
  async getBooking(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    const booking = await this.bookingService.getBooking(id);
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


  @Patch(':id/accept')
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
  @Roles(USER_ROLE.TECHNICIAN, USER_ROLE.ADMIN)
  @HttpCode(HttpStatus.OK)
  async updateBookingStatus(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: UpdateBookingStatusDto,
  ) {
    const booking = await this.bookingService.updateBookingStatus(
      req.user.id,
      req.user.role,
      id,
      dto,
    );
    return {
      success: true,
      message: `Booking status updated to ${dto.status} successfully`,
      data: booking,
    };
  }

  @Patch(':id/verify-otp')
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

  @Post(':id/resend-otp')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(USER_ROLE.TECHNICIAN)
  @HttpCode(HttpStatus.OK)
  async resendBookingOtp(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.bookingService.resendBookingOtp(
      req.user.id,
      id,
    );
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

  // Repeat bookings
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

  //Cancel Booking By Both Technician & Customer
  @Patch('cancel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(USER_ROLE.CUSTOMER, USER_ROLE.TECHNICIAN)
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
    return this.bookingService.cancelBooking(req.user, dto);
  }

  // cancel booking--Technician 
  // @Patch('technician/cancel')
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(USER_ROLE.TECHNICIAN)
  // async technicianCancelBooking(
  //   @Body() dto: TechnicianCancelBookingDto,
  //   @Req() req: any,
  // ) {
  //   return this.bookingService.technicianCancelBooking(dto, req.user);
  // }

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

  //Update Complaint Status By Admin   
  @Patch('admin/complaints/resolve/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(USER_ROLE.ADMIN)
  async resolveComplaint(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.bookingService.resolveComplaintService(id);
  }

  // Delete Complaint by admin 
  @Delete('complaint/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(USER_ROLE.ADMIN)
  @HttpCode(HttpStatus.OK)
  async deleteComplaint(@Param('id', ParseIntPipe) id: number) {
    return this.bookingService.deleteComplaint(id);
  }

  @Patch('review')
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

  //Customer get Technician all Reviews That Other Customer gave to them 
  @Get('technician/reviews/:technicianId')
  @UseGuards(JwtAuthGuard)
  async getTechnicianReviews(
    @Param('technicianId', ParseIntPipe) technicianId: number,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    return this.bookingService.getTechnicianReviews(
      technicianId,
      Number(page),
      Number(limit),
    );
  }

  @Get('technician/active-booking')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(USER_ROLE.TECHNICIAN)
  @HttpCode(HttpStatus.OK)
  async getActiveBookingForTechnician(
    @Req() req: any,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('search') search?: string,
  ) {
    const technicianId = req.user.id || req.user.sub;

    return this.bookingService.getActiveBookingForTechnician(
      technicianId,
      Number(page),
      Number(limit),
      search,
    );
  }

  @Get('technician/payout-stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(USER_ROLE.TECHNICIAN)
  @HttpCode(HttpStatus.OK)
  async getTechnicianPayoutStats(@Req() req: any) {
    const technicianId = req.user.id || req.user.sub;
    return this.bookingService.getTechnicianPayoutStats(technicianId);
  }
}
