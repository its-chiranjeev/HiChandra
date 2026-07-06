import {Booking, BOOKING_STATUS, BOOKING_PAYMENT_STATUS, Service, CustomerAddress, User, USER_ROLE, USER_STATUS, TECHNICIAN_STATUS, JOB_STATUS, TechnicianService, TechnicianLocation, Otp, PriceBreakdown, Payment, PAYMENT_STATUS, COMPLAINT_STATUS, TECHNICIAN_PAYOUT_STATUS} from '@hichandra/entities';
import { EmailService } from '@hichandra/email-services';
import { PaymentService, RazorpayXService } from '@hichandra/payment';
import { Injectable, NotFoundException, BadRequestException, UnprocessableEntityException , ForbiddenException, UnauthorizedException} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreateBookingDto, UpdateBookingStatusDto,CreateBookingReviewDto, StartBookingDto, AssignBookingDto, CancelBookingDto, CreateComplaintDto, UpdateComplaintDto, CreateTechnicianPayoutDto, RescheduleBookingDto, RepeatBookingDto , TechnicianCancelBookingDto } from '@hichandra/dtos';
import { AssignmentService } from '../assignment/assignment.service';
import { BookingRepository, UserRepository, ComplaintRepository, PaymentRepository, TechnicianPayoutRepository, TechnicianProfile } from '@hichandra/repositories';
import { randomUUID } from 'crypto';

@Injectable()
export class BookingService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly assignmentService: AssignmentService,
    private readonly emailService: EmailService,
    private readonly paymentService: PaymentService,
    private readonly razorpayXService: RazorpayXService,
    private readonly bookingRepository: BookingRepository,
    private readonly userRepository: UserRepository,
    private readonly complaintRepository: ComplaintRepository,
    private readonly paymentRepository: PaymentRepository,
    private readonly technicianPayoutRepository: TechnicianPayoutRepository,

  ) { }

  async createBooking(
    customerId: number,
    dto: CreateBookingDto,
  ): Promise<Booking> {
    return this.dataSource.transaction(async (manager) => {
      const serviceRepo = manager.getRepository(Service);
      const addressRepo = manager.getRepository(CustomerAddress);
      const bookingRepo = manager.getRepository(Booking);
      const technicianServices = await manager
        .getRepository(TechnicianService)
        .find({
          where: { serviceId: dto.serviceId },
        });
      
        
      // console.log(technicianServices);
      const allTechnicianWithService = await Promise.all(
        technicianServices.map(async (ts) => {
          const technicianProfileId = ts.technicianProfileId;
          const user = await manager.getRepository(User).findOne({ //add condition for technician should be available
            // where: { technicianProfileId: technicianProfileId },
            where: {
            status: USER_STATUS.ACTIVE,
            technicianProfile: {
              id: technicianProfileId,
              jobStatus: JOB_STATUS.AVAILABLE,
            },
          },
            relations: ['technicianProfile', 'technicianProfile.locations'],
          });
          if (user?.technicianProfile?.locations) {
            user.technicianProfile.locations =
              user.technicianProfile.locations.filter((loc) => loc.isDefault);
          }
          return user;
        }),
      );
      // console.log(allTechnicianWithService);
      const service = await serviceRepo.findOne({
        where: { id: dto.serviceId, isActive: true },
        relations: ['specifications', 'pricingRule'],
      });
      if (!service) {
        throw new NotFoundException('Service not found or inactive');
      }
      if (!service.pricingRule) {
        throw new BadRequestException(
          'Pricing rules are not configured for this service',
        );
      }

      // Check for existing pending booking of the same service (across all dates)
      const pendingBooking = await bookingRepo.findOne({
        where: {
          customerId,
          serviceId: dto.serviceId,
          status: BOOKING_STATUS.PENDING,
        },
      });
      if (pendingBooking) {
        throw new BadRequestException(
          'You already have a pending booking for this service',
        );
      }

      // Check for same-day booking of the same service
      const targetDate = dto.scheduledAt
        ? new Date(dto.scheduledAt)
        : new Date();
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      const sameDayBooking = await bookingRepo
        .createQueryBuilder('booking')
        .where('booking.customerId = :customerId', { customerId })
        .andWhere('booking.serviceId = :serviceId', {
          serviceId: dto.serviceId,
        })
        .andWhere('booking.scheduledAt BETWEEN :startOfDay AND :endOfDay', {
          startOfDay,
          endOfDay,
        })
        .andWhere('booking.status != :cancelledStatus', {
          cancelledStatus: BOOKING_STATUS.CANCELLED,
        })
        .getOne();

      if (sameDayBooking) {
        throw new BadRequestException(
          `You already have an active booking for this service on this date (Status: ${sameDayBooking.status})`,
        );
      }

      const dbSpecs = service.specifications || [];
      const userSpecs = dto.serviceSpecifications || [];
      const dbSpecsMap = new Map(dbSpecs.map((s) => [s.id, s]));

      // 1. Check if all required specs are present in userSpecs
      const requiredSpecs = dbSpecs.filter((s) => s.isRequired && s.isActive);
      for (const reqSpec of requiredSpecs) {
        const found = userSpecs.find((u) => u.specificationId === reqSpec.id);
        if (!found || found.value === undefined || found.value === null) {
          throw new BadRequestException(
            `Specification "${reqSpec.name}" (ID ${reqSpec.id}) is required`,
          );
        }
      }

      // 2. Validate userSpecs and fill names automatically
      for (const uSpec of userSpecs) {
        const dbSpec = dbSpecsMap.get(uSpec.specificationId);
        if (!dbSpec || !dbSpec.isActive) {
          throw new BadRequestException(
            `Specification ID ${uSpec.specificationId} is not valid for this service`,
          );
        }

        // Autofill name from DB if not provided
        uSpec.name = dbSpec.name;

        // Type checks
        if (dbSpec.type === 'number') {
          if (typeof uSpec.value !== 'number') {
            throw new BadRequestException(
              `Specification "${dbSpec.name}" must be a number`,
            );
          }
        } else if (dbSpec.type === 'select') {
          if (typeof uSpec.value !== 'string') {
            throw new BadRequestException(
              `Specification "${dbSpec.name}" must be a string value`,
            );
          }
          if (dbSpec.values && Array.isArray(dbSpec.values)) {
            const allowed = dbSpec.values as string[];
            if (!allowed.includes(uSpec.value)) {
              throw new BadRequestException(
                `Value "${uSpec.value}" is not valid for "${dbSpec.name}". Allowed values: ${allowed.join(', ')}`,
              );
            }
          }
        } else if (dbSpec.type === 'multiselect') {
          if (!Array.isArray(uSpec.value)) {
            throw new BadRequestException(
              `Specification "${dbSpec.name}" must be an array of string values`,
            );
          }
          if (dbSpec.values && Array.isArray(dbSpec.values)) {
            const allowed = dbSpec.values as string[];
            for (const val of uSpec.value) {
              if (typeof val !== 'string') {
                throw new BadRequestException(
                  `Each value in "${dbSpec.name}" must be a string`,
                );
              }
              if (!allowed.includes(val)) {
                throw new BadRequestException(
                  `Value "${val}" is not valid for "${dbSpec.name}". Allowed values: ${allowed.join(', ')}`,
                );
              }
            }
          }
        } else if (dbSpec.type === 'text') {
          if (typeof uSpec.value !== 'string') {
            throw new BadRequestException(
              `Specification "${dbSpec.name}" must be a string`,
            );
          }
        } else if (dbSpec.type === 'image') {
          if (typeof uSpec.value !== 'string') {
            throw new BadRequestException(
              `Specification "${dbSpec.name}" must be an image URL string`,
            );
          }
        }
      }

      const address = await addressRepo.findOne({
        where: {
          id: dto.customerAddressId,
          userId: customerId,
          isActive: true,
          // isDefault: true,
        },
      });
      if (!address) {
        throw new NotFoundException(
          'Address not found or does not belong to this customer',
        );
      }
      const serviceSpecifications = userSpecs.map((uSpec) => ({
        specificationId: uSpec.specificationId,
        value: uSpec.value,
      }));

      // Calculate Fare and Breakdown using new toggle booleans
      const pricingRule = service.pricingRule;
      const serviceBasePrice = Number(pricingRule.serviceBasePrice);
      const isWeekend = targetDate.getDay() === 0 || targetDate.getDay() === 6;
      const weekendMultiplier = isWeekend
        ? Number(pricingRule.weekendMultiplier)
        : 1.0;

      let isPeakHour = false;
      const hour = targetDate.getHours();
      if (pricingRule.peakHours && Array.isArray(pricingRule.peakHours)) {
        for (const range of pricingRule.peakHours) {
          if (hour >= range.start && hour <= range.end) {
            isPeakHour = true;
            break;
          }
        }
      }
      const peakHourMultiplier = isPeakHour
        ? Number(pricingRule.peakHourMultiplier)
        : 1.0;
      const surgeMultiplier = pricingRule.isSurgeEnabled
        ? Number(pricingRule.surgeFactor)
        : 1.0;

      const weekendCharge =
        pricingRule.isWeekendApplied && isWeekend
          ? Number((serviceBasePrice * (weekendMultiplier - 1)).toFixed(2))
          : 0;
      const peakHourCharge =
        pricingRule.isPeakHourApplied && isPeakHour
          ? Number((serviceBasePrice * (peakHourMultiplier - 1)).toFixed(2))
          : 0;
      const surgeCharge = pricingRule.isSurgeEnabled
        ? Number((serviceBasePrice * (surgeMultiplier - 1)).toFixed(2))
        : 0;
      const emergencyCharge =
        pricingRule.isEmergencyApplied && dto.isEmergency
          ? Number(pricingRule.emergencyCharge)
          : 0;
      const distanceCharge = 0; // Calculated dynamically if isDistanceKmApplied is true during assignment/completion

      const subtotal =
        serviceBasePrice +
        weekendCharge +
        peakHourCharge +
        surgeCharge +
        emergencyCharge +
        distanceCharge;

      const platformFee = pricingRule.isPlatformFeeApplied
        ? Number(pricingRule.platformFee)
        : 0;
      const gstRate = Number(pricingRule.gst) / 100;
      const gst = pricingRule.isGstApplied
        ? Number(((subtotal + platformFee) * gstRate).toFixed(2))
        : 0;

      const totalAmount = Number((subtotal + platformFee + gst).toFixed(2));

      // Make validation that totalAmount is greater than serviceBasePrice
      if (totalAmount <= serviceBasePrice) {
        throw new BadRequestException(
          'Calculation error: Total amount must be greater than the service base price.',
        );
      }

      const commissionRate = 0.15; // 15% platform commission
      const platformCommission = Number((subtotal * commissionRate).toFixed(2));
      const platformEarning = Number(
        (platformFee + platformCommission).toFixed(2),
      );
      const technicianEarning = Number(
        (subtotal - platformCommission).toFixed(2),
      );

      const priceBreakdown: PriceBreakdown = {
        serviceBasePrice,
        distanceCharge,
        emergencyCharge,
        peakHourCharge,
        weekendCharge,
        surgeCharge,
        gst,
        platformFee,
        technicianEarning,
        platformEarning,
      };

      const booking = bookingRepo.create({
        customerId,
        serviceId: dto.serviceId,
        addressId: dto.customerAddressId,
        serviceSpecifications: serviceSpecifications as any,
        isEmergency: dto.isEmergency ?? false,
        scheduledAt: targetDate,
        status: BOOKING_STATUS.PENDING,
        totalAmount,
        priceBreakdown,
      });

      // const savedBooking = await bookingRepo.save(booking);

      // // Filter technician list based on availability and send notifications
      // const activeTechnicians = allTechnicianWithService.filter(
      //   (u): u is User => !!u,
      // );
      // await this.assignmentService.assignTechnician(
      //   savedBooking,
      //   activeTechnicians,
      //   address,
      //   service,
      // );
      // throw new Error("hell");
      // return savedBooking;

      let savedBooking = await bookingRepo.save(booking);

      const bookingWithRelations = await bookingRepo.findOne({
        where: { id: savedBooking.id },
        relations: ['customer', 'service', 'address'],
      });

      if (!bookingWithRelations) {
        throw new NotFoundException('Booking not found after creation');
      }

      // Filter technician list based on availability and send notifications
      const activeTechnicians = allTechnicianWithService.filter(
        (u): u is User => !!u,
      );

      const matchedTechnicians =
      await this.assignmentService.assignTechnician(
        bookingWithRelations,
        activeTechnicians,
        address,
        service,
      );
      

    bookingWithRelations.filteredTechnicians =
      matchedTechnicians.map((tech) => tech.id);

    savedBooking = await bookingRepo.save(bookingWithRelations);
      //  throw new Error("hell");
      //     return savedBooking;

    return savedBooking;
    });
 }

  async getBooking(customerId: number, bookingId: number): Promise<Booking> {
    const bookingRepo = this.dataSource.getRepository(Booking);
    const booking = await bookingRepo.findOne({
      where: { id: bookingId, customerId },
      relations: ['service', 'address'],
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    return booking;
  }

  async getAllBookings(
    page: number,
    limit: number,
    status?: BOOKING_STATUS,
  ) {
    const { bookings, total } =
      await this.bookingRepository.findAllBookings(
        page,
        limit,
        status,
      );

    return {
      success: true,
      message: 'Bookings fetched successfully',
      data: bookings,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
  //complaint 
  async getAllComplaints(
    page: number,
    limit: number,
    status?: COMPLAINT_STATUS,
  ) {
    const {
      complaints,
      total,
    } = await this.complaintRepository.findAllComplaints(
      page,
      limit,
      status,
    );

    return {
      success: true,
      message: 'Complaints fetched successfully',
      data: complaints,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Complaint By ID
  async getComplaintById(id: number) {
    const complaint =
      await this.complaintRepository.findComplaintById(
        id,
      );

    if (!complaint) {
      throw new NotFoundException(
        'Complaint not found',
      );
    }

    return {
      success: true,
      message: 'Complaint fetched successfully',
      data: complaint,
    };
  }

  async getBookingById(id: number) {
    const booking =
      await this.bookingRepository.findBookingById(id);

    if (!booking) {
      throw new NotFoundException(
        'Booking not found',
      );
    }

    return {
      success: true,
      message: 'Booking fetched successfully',
      data: booking,
    };
  }

  async acceptBooking(technicianId: number, bookingId: number): Promise<Booking> {
    return this.dataSource.transaction(async (manager) => {
      const bookingRepo = manager.getRepository(Booking);
      const userRepo = manager.getRepository(User);

      const technician = await userRepo.findOne({
        where: { id: technicianId, role: USER_ROLE.TECHNICIAN },
        relations: ['technicianProfile'],
      });
      if (!technician) {
        throw new NotFoundException(
          'Technician not found or user is not a technician',
        );
      }
      if (
        technician.status !== USER_STATUS.ACTIVE ||
        technician.technicianProfile?.status !== TECHNICIAN_STATUS.APPROVED
      ) {
        throw new BadRequestException(
          'Technician is not active or not approved',
        );
      }

      const booking = await bookingRepo.findOne({ where: { id: bookingId } });
      if (!booking) {
        throw new NotFoundException('Booking not found');
      }

      if (booking.status !== BOOKING_STATUS.PENDING) {
        throw new BadRequestException('Booking is not in PENDING state');
      }

      if (booking.technicianId) {
        throw new BadRequestException(
          'Booking is already accepted by another technician',
        );
      }

      booking.technicianId = technicianId;
      booking.status = BOOKING_STATUS.ACCEPTED;

      return bookingRepo.save(booking);
    });
  }

  async assignBookingManually(
    dto: AssignBookingDto,)
   {
    const { bookingId, technicianId } = dto;

    // Validate booking
    const booking =
      await this.bookingRepository.findManualAssignableBooking(
        bookingId,
      );

    if (!booking) {
      throw new UnprocessableEntityException(
        'Booking not found, not pending, or manual assignment not allowed',
      );
    }

    // Prevent reassignment
    if (booking.technicianId) {
      throw new UnprocessableEntityException(
        'Booking already assigned',
      );
    }

    // Validate technician
    const technician =
      await this.userRepository.findTechnicianById(
        technicianId,
      );

    if (!technician) {
      throw new UnprocessableEntityException(
        'Technician not found or inactive',
      );
    }

    // Assign booking
    booking.technicianId = technician.id;
    booking.technician = technician;

    booking.status = BOOKING_STATUS.ACCEPTED;

    const updated =
      await this.bookingRepository.saveBooking(
        booking,
      );

    return {
      success: true,
      message: 'Booking assigned successfully',
      data: updated,
    };
  }

  async cancelBooking(
    customerId: number,
    dto: CancelBookingDto,)
   {
    const { bookingId, cancellationReason } = dto;

    const booking =
      await this.bookingRepository.findCustomerBooking(
        bookingId,
        customerId,
      );

    if (!booking) {
      throw new UnprocessableEntityException(
        'Booking not found or does not belong to customer',
      );
    }

    if (booking.status === BOOKING_STATUS.CANCELLED) {
      throw new UnprocessableEntityException(
        'Booking already cancelled',
      );
    }

    if (booking.status === BOOKING_STATUS.COMPLETED) {
      throw new UnprocessableEntityException(
        'Completed booking cannot be cancelled',
      );
    }

    booking.status = BOOKING_STATUS.CANCELLED;
    booking.cancellationReason = cancellationReason;

    const updated =
      await this.bookingRepository.saveBooking(
        booking,
      );

    return {
      success: true,
      message: 'Booking cancelled successfully',
      data: updated,
    };
  }

  async createComplaint(
    user: any,
    dto: CreateComplaintDto,
  ) {
    const booking =
      await this.bookingRepository.findBookingById(
        dto.bookingId,
      );

    if (!booking) {
      throw new NotFoundException(
        'Booking not found',
      );
    }
    if (!user?.id) {
      throw new UnauthorizedException(
        'Invalid user',
      );
    }

    if (booking.serviceId !== dto.serviceId) {
      throw new BadRequestException(
        'Invalid service for this booking',
      );
    }

    if (user.role === USER_ROLE.CUSTOMER) {
      if (booking.customerId !== user.id) {
        throw new BadRequestException(
          'This booking does not belong to you',
        );
      }
    } else if (
      user.role === USER_ROLE.TECHNICIAN
    ) {
      if (booking.technicianId !== user.id) {
        throw new BadRequestException(
          'This booking is not assigned to you',
        );
      }
    } else {
      throw new BadRequestException(
        'Invalid role for complaint creation',
      );
    }
    const pendingComplaint =
      await this.complaintRepository.findPendingComplaint(
        dto.bookingId,
        dto.serviceId,
      );

    if (pendingComplaint) {
      throw new BadRequestException(
        'A complaint is already pending for this booking',
      );
    }

    const complaint =
      await this.complaintRepository.createComplaint({
        bookingId: dto.bookingId,
        serviceId: dto.serviceId,
        title: dto.title,
        description: dto.description,
        createdBy: user.id,
        createdByRole: user.role,
        status: COMPLAINT_STATUS.PENDING,
      });

    return {
      success: true,
      message: 'Complaint created successfully',
      data: complaint,
    };
  }
  //edit complaint
  async updateComplaint(
    user: any,
    complaintId: number,
    dto: UpdateComplaintDto,
  ) {
    const complaint =
      await this.complaintRepository.findComplaintById(
        complaintId,
      );

    if (!complaint) {
      throw new NotFoundException(
        'Complaint not found',
      );
    }

    if (complaint.createdBy !== user.id) {
      throw new BadRequestException(
        'You can only edit your own complaint',
      );
    }

    if (
      complaint.status !==
      COMPLAINT_STATUS.PENDING
    ) {
      throw new BadRequestException(
        'Only pending complaints can be edited',
      );
    }

    const booking =
      await this.bookingRepository.findBookingById(
        dto.bookingId,
      );

    if (!booking) {
      throw new NotFoundException(
        'Booking not found',
      );
    }

    if (
      booking.serviceId !== dto.serviceId
    ) {
      throw new BadRequestException(
        'Invalid service for this booking',
      );
    }

    complaint.bookingId = dto.bookingId;
    complaint.serviceId = dto.serviceId;
    complaint.title = dto.title;
    complaint.description = dto.description;

    await this.complaintRepository.saveComplaint(
      complaint,
    );

    return {
      success: true,
      message:
        'Complaint updated successfully',
      data: complaint,
    };
  }

  async updateBookingStatus(
    technicianId: number,
    bookingId: number,
    dto: UpdateBookingStatusDto,
  ): Promise<Booking> {
    return this.dataSource.transaction(async (manager) => {
      const bookingRepo = manager.getRepository(Booking);
      const otpRepo = manager.getRepository(Otp);
      const technicianProfileRepo = manager.getRepository(TechnicianProfile);

      const booking = await bookingRepo.findOne({
        where: { id: bookingId },
        relations: ['customer'],
      });

      if (!booking) {
        throw new NotFoundException('Booking not found');
      }

      if (booking.technicianId !== technicianId) {
        throw new BadRequestException('You are not assigned to this booking');
      }

      if (
        dto.status !== BOOKING_STATUS.ENROUTE &&
        dto.status !== BOOKING_STATUS.ARRIVED &&
        dto.status !== BOOKING_STATUS.CANCELLED &&
        dto.status !== BOOKING_STATUS.COMPLETED
      ) {
        throw new BadRequestException('Invalid status transition');
      }

      // Enforce sequence: ACCEPTED -> ENROUTE -> ARRIVED
      if (dto.status === BOOKING_STATUS.ENROUTE) {
        if (booking.status !== BOOKING_STATUS.ACCEPTED) {
          throw new BadRequestException(
            'Booking must be in ACCEPTED state to change to ENROUTE',
          );
        }
      }

      if (dto.status === BOOKING_STATUS.ARRIVED) {
        if (booking.status !== BOOKING_STATUS.ENROUTE) {
          throw new BadRequestException(
            'Booking must be in ENROUTE state to change to ARRIVED',
          );
        }
      }

      if (dto.status === BOOKING_STATUS.CANCELLED) {
        // Cancel can be up to ARRIVED, once it's ONGOING it cannot be cancelled
        if (
          booking.status === BOOKING_STATUS.ONGOING ||
          booking.status === BOOKING_STATUS.COMPLETED ||
          booking.status === BOOKING_STATUS.CANCELLED
        ) {
          throw new BadRequestException(
            'Booking cannot be cancelled once it is ongoing, completed, or already cancelled',
          );
        }
        if (dto.cancellationReason) {
          booking.cancellationReason = dto.cancellationReason;
          booking.cancelledBy = technicianId;
        }
      }

      if (dto.status === BOOKING_STATUS.COMPLETED) {
        // Ongoing -> Completed transition
        if (booking.status !== BOOKING_STATUS.ONGOING) {
          throw new BadRequestException(
            'Booking must be in ONGOING state to change to COMPLETED',
          );
        }
        booking.completedAt = new Date();
      }

      booking.status = dto.status;
      const updatedBooking = await bookingRepo.save(booking);

      if (dto.status === BOOKING_STATUS.ENROUTE) {
        await technicianProfileRepo.update(
          { userId: technicianId },
          { jobStatus: JOB_STATUS.BUSY },
        );
      }

      if (
        dto.status === BOOKING_STATUS.COMPLETED ||
        dto.status === BOOKING_STATUS.CANCELLED
      ) {
        await technicianProfileRepo.update(
          { userId: technicianId },
          { jobStatus: JOB_STATUS.AVAILABLE },
        );
      }

      if (dto.status === BOOKING_STATUS.ARRIVED) {
        if (!booking.customer || !booking.customer.email) {
          throw new BadRequestException(
            'Customer does not have a registered email address',
          );
        }

        // Generate 6-digit OTP
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

        // Send Email
        await this.emailService.sendOtpEmail(
          booking.customer.email,
          otpCode,
          booking.customer.firstName,
        );

        // Delete previous unverified OTPs for the customer's email
        await otpRepo.delete({
          email: booking.customer.email,
          isVerified: false,
        });

        // Save new OTP
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 10); // OTP expires in 10 minutes

        const newOtp = otpRepo.create({
          email: booking.customer.email,
          otp: otpCode,
          expiresAt,
          role: USER_ROLE.CUSTOMER,
          isVerified: false,
        });
        await otpRepo.save(newOtp);
      }

      return updatedBooking;
    });
  }

  async startBooking(
    technicianId: number,
    bookingId: number,
    dto: StartBookingDto,
  ): Promise<Booking> {
    return this.dataSource.transaction(async (manager) => {
      const bookingRepo = manager.getRepository(Booking);
      const otpRepo = manager.getRepository(Otp);

      const booking = await bookingRepo.findOne({
        where: { id: bookingId },
        relations: ['customer'],
      });

      if (!booking) {
        throw new NotFoundException('Booking not found');
      }

      if (booking.technicianId !== technicianId) {
        throw new BadRequestException('You are not assigned to this booking');
      }

      if (booking.status !== BOOKING_STATUS.ARRIVED) {
        throw new BadRequestException(
          'Booking must be in ARRIVED status to start work',
        );
      }

      if (!booking.customer || !booking.customer.email) {
        throw new BadRequestException(
          'Customer does not have a registered email address',
        );
      }

      // Verify the latest unverified OTP
      const latestOtp = await otpRepo.findOne({
        where: { email: booking.customer.email, isVerified: false },
        order: { createdAt: 'DESC' },
      });

      if (!latestOtp) {
        throw new BadRequestException(
          'No active OTP found for this customer. Please send it again.',
        );
      }

      if (latestOtp.otp !== dto.otp) {
        throw new BadRequestException('Invalid OTP');
      }

      if (latestOtp.expiresAt < new Date()) {
        throw new BadRequestException('OTP has expired');
      }

      // Delete the verified OTP to prevent reuse and clean up
      await otpRepo.remove(latestOtp);

      // Transition booking to ONGOING and record startedAt time
      booking.status = BOOKING_STATUS.ONGOING;
      booking.startedAt = new Date();
      const updatedBooking = await bookingRepo.save(booking);

      return updatedBooking;
    });
  }

  async getPaymentUrl(
    userId: number,
    bookingId: number,
  ): Promise<{ paymentUrl: string }> {
    return this.dataSource.transaction(async (manager) => {
      const bookingRepo = manager.getRepository(Booking);
      const paymentRepo = manager.getRepository(Payment);

      const booking = await bookingRepo.findOne({
        where: { id: bookingId },
        relations: ['customer'],
      });

      if (!booking) {
        throw new NotFoundException('Booking not found');
      }

      if (booking.customerId !== userId) {
        throw new BadRequestException(
          'You do not have permission to generate a payment link for this booking',
        );
      }

      if (booking.status !== BOOKING_STATUS.COMPLETED) {
        throw new BadRequestException(
          'Payment can only be requested for COMPLETED bookings',
        );
      }

      // Check for any successful payments to prevent double charging
      const successfulPayment = await paymentRepo.findOne({
        where: { bookingId, status: PAYMENT_STATUS.SUCCESS },
      });
      if (successfulPayment) {
        throw new BadRequestException(
          'This booking has already been paid successfully.',
        );
      }

      if (!booking.customer) {
        throw new BadRequestException(
          'Customer associated with the booking not found',
        );
      }

      const amount = Number(booking.totalAmount);
      if (!amount || amount <= 0) {
        throw new BadRequestException(
          'Booking does not have a valid total amount',
        );
      }

      const customerName =
        `${booking.customer.firstName || ''} ${booking.customer.lastName || ''}`.trim() ||
        'Customer';
      const customerEmail = booking.customer.email;
      const customerPhone = booking.customer.phone || '';

      const paymentLink = await this.paymentService.createPaymentLink(
        amount,
        booking.id,
        {
          name: customerName,
          email: customerEmail,
          phone: customerPhone,
        },
      );

      // Save a new pending payment record in DB
      const newPayment = paymentRepo.create({
        bookingId: booking.id,
        customerId: booking.customerId,
        amount,
        currency: 'INR',
        status: PAYMENT_STATUS.PENDING,
        paymentLinkId: paymentLink.paymentLinkId,
      });
      await paymentRepo.save(newPayment);

      return { paymentUrl: paymentLink.url };
    });
  }

  async handlePaymentWebhook(
    payload: any,
    signature: string,
  ) {

    const isValid =
      this.paymentService.verifyWebhook(
        JSON.stringify(payload),
        signature,
      );

    if (!isValid) {
      throw new BadRequestException(
        'Invalid webhook signature',
      );
    }

    if (
      payload.event !==
      'payment_link.paid'
    ) {
      return {
        success: true,
        message: 'Event ignored',
      };
    }

    const paymentLinkId =
      payload.payload.payment_link.entity.id;

    const paymentId =
      payload?.payload?.payment?.entity?.id;

    const payment =
      await this.paymentRepository.findByPaymentLinkId(
        paymentLinkId,
      );

    if (!payment) {
      throw new NotFoundException(
        'Payment not found',
      );
    }

    if (payment.status === PAYMENT_STATUS.SUCCESS) {

    // const payout =
    //   await this.technicianPayoutRepository.findByPaymentRecordId(
    //     payment.id,
    //   );

    // if (
    //   payout &&
    //   payout.status !== PAYMENT_STATUS.SUCCESS
    // ) {
    //   payout.status = PAYMENT_STATUS.SUCCESS;

    //   await this.technicianPayoutRepository.updatePayout(
    //     payout,
    //   );
    // }

    return {
      success: true,
      message: 'Payment already processed',
    };
  }

    payment.status =
      PAYMENT_STATUS.SUCCESS;

    payment.paymentId =
      paymentId;

    await this.paymentRepository.updatePayment(
      payment,
    );

    payment.booking.paymentStatus =
      BOOKING_PAYMENT_STATUS.PAID;

    await this.bookingRepository.saveBooking(
      payment.booking,
    );

    // const payout =
    //   await this.technicianPayoutRepository.findByPaymentRecordId(
    //     payment.id,
    // );

    // if (payout) {
    //   payout.status =
    //     PAYMENT_STATUS.SUCCESS;

    //   await this.technicianPayoutRepository.updatePayout(
    //     payout,
    //   );
    // }

    return {
      success: true,
      message:
        'Payment updated successfully',
      data: payment,
    };
  }

  // async createTechnicianPayout(
  //   adminId: number,
  //   dto: CreateTechnicianPayoutDto,
  // ) {
  //   const booking =
  //     await this.bookingRepository.findBookingById(
  //       dto.bookingId,
  //     );

  //   if (!booking) {
  //     throw new NotFoundException(
  //       'Booking not found',
  //     );
  //   }

  //   if (
  //     booking.status !==
  //     BOOKING_STATUS.COMPLETED
  //   ) {
  //     throw new BadRequestException(
  //       'Booking is not completed yet',
  //     );
  //   }

  //   if (
  //     booking.paymentStatus !==
  //     BOOKING_PAYMENT_STATUS.PAID
  //   ) {
  //     throw new BadRequestException(
  //       'Customer payment is not completed yet',
  //     );
  //   }

  //   const technician =
  //     await this.userRepository.findOne({
  //       where: {
  //         id: dto.technicianId,
  //         role: USER_ROLE.TECHNICIAN,
  //       },
  //       relations: ['technicianProfile'], //added
  //     });

  //   if (!technician) {
  //     throw new NotFoundException(
  //       'Technician not found',
  //     );
  //   }

  //   //added
  //   const profile = technician.technicianProfile;

  //   if (!profile) {
  //     throw new BadRequestException(
  //       'Technician profile not found',
  //     );
  //   }

  //   if (
  //     !profile.accountHolderName ||
  //     !profile.accountNumber ||
  //     !profile.ifscCode ||
  //     !profile.bankName
  //   ) {
  //     throw new BadRequestException(
  //       'Technician bank details are incomplete',
  //     );
  //   }

  //   const existingPayout =
  //     await this.technicianPayoutRepository.findExistingPayout(
  //       dto.bookingId,
  //       dto.technicianId,
  //     );

  //   if (existingPayout) {
  //     throw new BadRequestException(
  //       'Payout already exists',
  //     );
  //   }

  //   const payoutDescription = `
  //   Technician Payout

  //   Technician: ${technician.firstName || technician.username}

  //   Bank Name: ${profile.bankName}
  //   Account Holder: ${profile.accountHolderName}
  //   Account Number: ${profile.accountNumber}
  //   IFSC Code: ${profile.ifscCode}

  //   Booking ID: ${dto.bookingId}
  //   Service ID: ${dto.serviceId}
  //   Amount: ₹${dto.totalAmount}
  //   `;

  //   const paymentLink =
  //     await this.paymentService.createPaymentLink(
  //       dto.totalAmount,
  //       dto.bookingId,
  //       {
  //         name:
  //           technician.firstName ||
  //           technician.username,
  //         email: technician.email,
  //         phone: technician.phone,
  //       },
  //       payoutDescription,
  //     );

  //   const payment =
  //     await this.paymentRepository.createPayment(
  //       {
  //         bookingId: dto.bookingId,
  //         customerId: adminId,
  //         technicianId:
  //           dto.technicianId,
  //         amount: dto.totalAmount,
  //         currency: 'INR',
  //         paymentLinkId:
  //           paymentLink.paymentLinkId,
  //         status:
  //           PAYMENT_STATUS.PENDING,           
  //       },
  //     );



  //   const payout =
  //     await this.technicianPayoutRepository.createPayout(
  //       {
  //         bookingId: dto.bookingId,
  //         serviceId: dto.serviceId,
  //         technicianId:
  //           dto.technicianId,
  //         payoutBy: adminId,
  //         amount: dto.totalAmount,
  //         paymentRecordId:
  //           payment.id,
  //         status:
  //           TECHNICIAN_PAYOUT_STATUS.PENDING,
  //       },
  //     );

  //   return {
  //     success: true,
  //     message:
  //       'Payout link generated successfully',
  //     data: {
  //       payoutId: payout.id,
  //       paymentRecordId:
  //         payment.id,
  //       paymentUrl:
  //         paymentLink.url,
  //       bankDetails: {
  //         bankName: profile.bankName,
  //         accountHolderName: profile.accountHolderName,
  //         accountNumber: profile.accountNumber,
  //         ifscCode: profile.ifscCode,
  //       },
  //     },
  //   };
  // }

  

  async createTechnicianPayout(
    adminId: number,
    dto: CreateTechnicianPayoutDto,
  ) {
    const booking = await this.bookingRepository.findBookingById(
      dto.bookingId,
    );

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.status !== BOOKING_STATUS.COMPLETED) {
      throw new BadRequestException('Booking is not completed yet');
    }

    if (booking.paymentStatus !== BOOKING_PAYMENT_STATUS.PAID) {
      throw new BadRequestException(
        'Customer payment is not completed yet',
      );
    }

    if (!booking.technicianId) {
      throw new BadRequestException(
        'No technician is assigned to this booking',
      );
    }

    const technician = await this.userRepository.findOne({
      where: {
        id: booking.technicianId,
        role: USER_ROLE.TECHNICIAN,
      },
      relations: ['technicianProfile'],
    });

    if (!technician) {
      throw new NotFoundException('Technician not found');
    }

    const profile = technician.technicianProfile;

    if (!profile) {
      throw new BadRequestException('Technician profile not found');
    }

    if (!profile.razorpayFundAccountId) {
      throw new BadRequestException(
        'Technician fund account is not created',
      );
    }

    const payoutAmount = Number(
      booking.priceBreakdown?.technicianEarning ?? 0,
    );

    if (!payoutAmount || payoutAmount <= 0) {
      throw new BadRequestException(
        'Technician payout amount is invalid',
      );
    }

    const existingPayout =
      await this.technicianPayoutRepository.findExistingPayout(
        booking.id,
        technician.id,
      );

    if (
      existingPayout &&
      [
        TECHNICIAN_PAYOUT_STATUS.PENDING,
        TECHNICIAN_PAYOUT_STATUS.PROCESSING,
        TECHNICIAN_PAYOUT_STATUS.SUCCESS,
      ].includes(existingPayout.status)
    ) {
      throw new BadRequestException(
        'An active or successful payout already exists',
      );
    }

    const idempotencyKey = randomUUID();

    const payout = await this.technicianPayoutRepository.createPayout({
      bookingId: booking.id,
      serviceId: booking.serviceId,
      technicianId: technician.id,
      payoutBy: adminId,
      amount: payoutAmount,
      idempotencyKey,
      status: TECHNICIAN_PAYOUT_STATUS.PENDING,
    });

    try {
      const razorpayPayout =
        await this.razorpayXService.createPayout({
          fundAccountId: profile.razorpayFundAccountId,
          amount: payoutAmount,
          bookingId: booking.id,
          technicianId: technician.id,
          internalPayoutId: payout.id,
          idempotencyKey,
        });

      payout.razorpayPayoutId = razorpayPayout.id;

      if (razorpayPayout.status === 'processed') {
        payout.status = TECHNICIAN_PAYOUT_STATUS.SUCCESS;
        payout.utr = razorpayPayout.utr || null;
      } else if (razorpayPayout.status === 'failed') {
        payout.status = TECHNICIAN_PAYOUT_STATUS.FAILED;
        payout.failureReason =
          razorpayPayout.status_details?.description ||
          'RazorpayX payout failed';
      } else {
        payout.status = TECHNICIAN_PAYOUT_STATUS.PROCESSING;
      }

      await this.technicianPayoutRepository.updatePayout(payout);

      return {
        success: true,
        message: 'Technician payout initiated successfully',
        data: {
          payoutId: payout.id,
          razorpayPayoutId: payout.razorpayPayoutId,
          amount: payout.amount,
          status: payout.status,
        },
      };
    } catch (error) {
      payout.status = TECHNICIAN_PAYOUT_STATUS.FAILED;
      payout.failureReason =
        error instanceof Error
          ? error.message
          : 'Failed to initiate technician payout';

      await this.technicianPayoutRepository.updatePayout(payout);

      throw error;
    }
  }

  //payment
  async getAllPayments(
    page: number,
    limit: number,
    status?: PAYMENT_STATUS,
  ) {
    return this.paymentRepository.findAllPayments(
      page,
      limit,
      status,
    );
  }

  //Get Paymwents By ID 
  async getPaymentById(id: number) {
    const payment =
      await this.paymentRepository.findPaymentById(id);

    if (!payment) {
      throw new NotFoundException(
        'Payment not found',
      );
    }

    return {
      success: true,
      message: 'Payment fetched successfully',
      data: payment,
    };
  }

  async rescheduleBooking(
    bookingId: number,
    dto: RescheduleBookingDto,
    user: any,
  ) {
    const booking =
      await this.bookingRepository.findBookingById(bookingId);

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (
      user.role === USER_ROLE.CUSTOMER &&
      booking.customerId !== user.id
    ) {
      throw new UnauthorizedException(
        'You cannot reschedule this booking',
      );
    }

    const allowedStatuses = [
      BOOKING_STATUS.PENDING,
      BOOKING_STATUS.ACCEPTED,
    ];

    if (!allowedStatuses.includes(booking.status)) {
      throw new BadRequestException(
        `Booking cannot be rescheduled when status is ${booking.status}`,
      );
    }

    booking.scheduledAt = new Date(dto.scheduledAt);

    const updated =
      await this.bookingRepository.saveBooking(booking);

    return {
      message: 'Booking rescheduled successfully',
      data: updated,
    };
  }

  async repeatBooking(
    id: number,
    dto: RepeatBookingDto,
    user: any,
  ) {
    const oldBooking =
      await this.bookingRepository.findBookingById(id);

    if (!oldBooking) {
      throw new NotFoundException('Booking not found');
    }

    if (oldBooking.customerId !== user.id) {
      throw new ForbiddenException(
        'You can repeat only your own booking',
      );
    }

    const newBooking: Partial<Booking> = {
      customerId: oldBooking.customerId,
      serviceId: oldBooking.serviceId,
      addressId: oldBooking.addressId,

      serviceSpecifications:
        oldBooking.serviceSpecifications,

      isEmergency: oldBooking.isEmergency ?? false,
      scheduledAt: new Date(dto.scheduledAt),

      status: BOOKING_STATUS.PENDING,

      totalAmount: oldBooking.totalAmount,
      priceBreakdown: oldBooking.priceBreakdown,
    };

    const savedBooking =
      await this.bookingRepository.createBooking(newBooking);

    return {
      success: true,
      message: 'Booking repeated successfully',
      data: savedBooking,
    };
  }

  async technicianCancelBooking(dto: TechnicianCancelBookingDto, user: any) {
    const booking = await this.bookingRepository.findBookingById(dto.bookingId);

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (!booking.technician || booking.technician.id !== user.id) {
      throw new ForbiddenException('You are not assigned to this booking');
    }

    if (booking.status !== BOOKING_STATUS.ACCEPTED) {
      throw new BadRequestException(
        'Only accepted booking can be cancelled by technician',
      );
    }

    booking.status = BOOKING_STATUS.PENDING;

    await this.bookingRepository.saveBooking(booking);

    return {
      success: true,
      message: 'Booking cancelled successfully',
      data: booking,
    };
  }

  async createBookingReview(
  user: any,
  dto: CreateBookingReviewDto,
  ) {
    const booking =
      await this.bookingRepository.findBookingById(dto.bookingId);

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.status !== BOOKING_STATUS.COMPLETED) {
      throw new BadRequestException('Booking is not completed');
    }

    if (booking.paymentStatus !== BOOKING_PAYMENT_STATUS.PAID) {
      throw new BadRequestException('Payment is not completed');
    }

    if (
      dto.rating === undefined &&
      (!dto.review || dto.review.trim() === '')
    ) {
      throw new BadRequestException(
        'Please provide rating or review',
      );
    }

    let updatedBooking: Booking | null = null;

    if (user.role === USER_ROLE.CUSTOMER) {
      if (booking.customerId !== user.id) {
        throw new BadRequestException(
          'You are not allowed to review this booking',
        );
      } 

      if (
        booking.customerRating !== null ||
        booking.customerReview
      ) {
        throw new BadRequestException(
          'Customer feedback already submitted',
        );
      }

      if (!booking.technicianId) {
        throw new BadRequestException(
          'Technician not assigned to this booking',
        );
      }

      updatedBooking =
        await this.bookingRepository.updateReviewFields(
          booking.id,
          {
            customerRating: dto.rating,
            customerReview: dto.review,
          },
        );

      if (dto.rating !== undefined) {
        await this.updateTechnicianOverallRating(
          booking.technicianId,
        );
      }
    } else if (user.role === USER_ROLE.TECHNICIAN) {
      if (booking.technicianId !== user.id) {
        throw new BadRequestException(
          'You are not assigned to this booking',
        );
      }

      if (
        booking.technicianRating !== null ||
        booking.technicianReview
      ) {
        throw new BadRequestException(
          'Technician feedback already submitted',
        );
      }

      updatedBooking =
        await this.bookingRepository.updateReviewFields(
          booking.id,
          {
            technicianRating: dto.rating,
            technicianReview: dto.review,
          },
        );

      if (dto.rating !== undefined) {
        await this.updateCustomerOverallRating(
          booking.customerId,
        );
      }
    } else {
      throw new ForbiddenException('Invalid user role');
    }

    if (user.role === USER_ROLE.CUSTOMER) {
      return {
        success: true,
        message: 'Review submitted successfully',
        data: {
          bookingId: updatedBooking?.id,
          customerRating: updatedBooking?.customerRating,
          customerReview: updatedBooking?.customerReview,
        },
      };
    }

    return {
      success: true,
      message: 'Review submitted successfully',
      data: {
        bookingId: updatedBooking?.id,
        technicianRating: updatedBooking?.technicianRating,
        technicianReview: updatedBooking?.technicianReview,
      },
    };
  }

 async updateTechnicianOverallRating(
  technicianId: number,
  ) {
    const bookings =
      await this.bookingRepository.findTechnicianRatedBookings(
        technicianId,
      );

    const ratings = bookings
      .map((booking) => booking.customerRating)
      .filter(
        (rating): rating is number =>
          rating !== null && rating !== undefined,
      );

    const technician =
      await this.userRepository.findOne({
        where: { id: technicianId },
      });

    if (!technician) {
      return;
    }

    if (!ratings.length) {
      technician.overallRating = null;
    } else {
      const average =
        ratings.reduce((sum, rating) => sum + rating, 0) /
        ratings.length;

      technician.overallRating = Number(average.toFixed(2));
    }

    await this.userRepository.save(technician);
  }

  async updateCustomerOverallRating(
    customerId: number,
  ) {
    const bookings =
      await this.bookingRepository.findCustomerRatedBookings(
        customerId,
      );

    const ratings = bookings
      .map((booking) => booking.technicianRating)
      .filter(
        (rating): rating is number =>
          rating !== null && rating !== undefined,
      );

    const customer =
      await this.userRepository.findOne({
        where: { id: customerId },
      });

    if (!customer) {
      return;
    }

    if (!ratings.length) {
      customer.overallRating = null;
    } else {
      const average =
        ratings.reduce((sum, rating) => sum + rating, 0) /
        ratings.length;

      customer.overallRating = Number(average.toFixed(2));
    }

    await this.userRepository.save(customer);
  }
}