import { Booking, BOOKING_STATUS, BOOKING_PAYMENT_STATUS, Service, CustomerAddress, User, USER_ROLE, USER_STATUS, TECHNICIAN_STATUS, JOB_STATUS, TechnicianService, TechnicianLocation, Otp, PriceBreakdown, Payment, PAYMENT_STATUS, COMPLAINT_STATUS, TechnicianProfile, TechnicianPayoutAccount, Complaint, REVIEW_STATUS, PAYMENT_TYPE } from '@hichandra/entities';
import { EmailService } from '@hichandra/email-services';
import { PaymentService, RazorpayXService } from '@hichandra/payment';
import { Injectable, NotFoundException, BadRequestException, UnprocessableEntityException, ForbiddenException, UnauthorizedException, Logger } from '@nestjs/common';
import { DataSource, Not, IsNull } from 'typeorm';
import { CreateBookingDto, UpdateBookingStatusDto, CreateBookingReviewDto, StartBookingDto, AssignBookingDto, CancelBookingDto, CreateComplaintDto, UpdateComplaintDto, CreateTechnicianPayoutDto, RescheduleBookingDto, RepeatBookingDto, TechnicianCancelBookingDto, AdminCreateBookingDto, AdminUpdateBookingReviewDto } from '@hichandra/dtos';
import { AssignmentService } from '../assignment/assignment.service';
import { BookingRepository, UserRepository, ComplaintRepository, PaymentRepository, ServiceRepository } from '@hichandra/repositories';
import { S3Service } from '@hichandra/s3';
import { randomUUID } from 'crypto';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class BookingService {
  private readonly logger = new Logger(BookingService.name
  );

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
    private readonly s3Service: S3Service,
    private readonly serviceRepository: ServiceRepository,
  ) { }

  private getIstDateParts(date: Date) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      weekday: 'short',
      hour: 'numeric',
      hour12: false,
    }).formatToParts(date);

    const weekday = parts.find((p) => p.type === 'weekday')?.value;
    const hour = Number(parts.find((p) => p.type === 'hour')?.value);

    return { weekday, hour };
  }

  private toIstString(date?: Date | string | null) {
    if (!date) return null;

    return new Date(date).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  }

  async createBooking(
    customerId: number,
    dto: CreateBookingDto,
    userRole?: USER_ROLE,
    // ): Promise<Booking> {
  ): Promise<any> {
    return this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      const customer = await userRepo.findOne({
        where: { id: customerId },
      });
      if (!customer) {
        throw new NotFoundException('Customer not found');
      }
      if (userRole !== USER_ROLE.ADMIN && !customer.isTokenPaid) {
        throw new BadRequestException('Token payment is required before booking');
      }

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
      // const targetDate = dto.scheduledAt
      //   ? new Date(dto.scheduledAt)
      //   : new Date();
      // const startOfDay = new Date(targetDate);
      // startOfDay.setHours(0, 0, 0, 0);
      // const endOfDay = new Date(targetDate);
      // endOfDay.setHours(23, 59, 59, 999);
      //added
      const targetDate = dto.scheduledAt
        ? new Date(dto.scheduledAt)
        : new Date();

      if (Number.isNaN(targetDate.getTime())) {
        throw new BadRequestException('Invalid scheduledAt date');
      }

      // Get IST date only, example: 2026-07-08
      const istDateString = targetDate.toLocaleDateString('en-CA', {
        timeZone: 'Asia/Kolkata',
      });

      // IST day range converted to UTC for DB query
      const startOfDay = new Date(`${istDateString}T00:00:00.000+05:30`);
      const endOfDay = new Date(`${istDateString}T23:59:59.999+05:30`);
      //
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
      // const isWeekend = targetDate.getDay() === 0 || targetDate.getDay() === 6;
      // const weekendMultiplier = isWeekend
      //   ? Number(pricingRule.weekendMultiplier)
      //   : 1.0;

      // let isPeakHour = false;
      // const hour = targetDate.getHours();
      //added
      const { weekday, hour } = this.getIstDateParts(targetDate);

      const isWeekend = weekday === 'Sat' || weekday === 'Sun';

      const weekendMultiplier = isWeekend
        ? Number(pricingRule.weekendMultiplier)
        : 1.0;

      let isPeakHour = false;
      //
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
      if (totalAmount < serviceBasePrice) {
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

      //return savedBooking;
      return {
        ...savedBooking,
        scheduledAtIst: this.toIstString(savedBooking.scheduledAt),
        createdAtIst: this.toIstString(savedBooking.createdAt),
        updatedAtIst: this.toIstString(savedBooking.updatedAt),
      } as Booking & {
        scheduledAtIst: string | null;
        createdAtIst: string | null;
        updatedAtIst: string | null;
      };
    });
  }

  @Cron(
    CronExpression.EVERY_MINUTE,
    {
      name: 'mark-expired-bookings-manual',
    },
  )
  async markExpiredBookingsManual(): Promise<void> {
    try {
      const updatedCount =
        await this.bookingRepository
          .markExpiredAsManual();

      if (updatedCount > 0) {
        this.logger.log(
          `${updatedCount} booking(s) marked for manual assignment`,
        );
      }
    } catch (error) {
      this.logger.error(
        'Failed to update expired bookings',
        error instanceof Error
          ? error.stack
          : String(error),
      );
    }
  }

  async getBooking(bookingId: number): Promise<any> {
    const booking = await this.bookingRepository.findBookingById(bookingId);

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    const payments = await this.dataSource.getRepository(Payment).find({
      where: { bookingId },
      order: { createdAt: 'DESC' },
    });

    const complaints = await this.dataSource.getRepository(Complaint).find({
      where: { bookingId },
      order: { createdAt: 'DESC' },
    });

    const payouts = await this.dataSource.getRepository(Payment).find({
      where: { bookingId, payoutBy: Not(IsNull()) },
      order: { createdAt: 'DESC' },
    });

    return {
      ...booking,
      payments,
      complaints,
      payouts,
    };
  }

  async getAllBookings(
    user: any,
    page: number,
    limit: number,
    status?: BOOKING_STATUS,
    sortById?: string,
    sortByUpdatedAt?: string,
    reviewStatus?: REVIEW_STATUS,
  ) {
    let sortBy: 'id' | 'updatedAt' = 'id';
    let finalSortOrder: 'ASC' | 'DESC' = 'DESC';

    if (sortById) {
      sortBy = 'id';
      finalSortOrder = sortById.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    } else if (sortByUpdatedAt) {
      sortBy = 'updatedAt';
      finalSortOrder = sortByUpdatedAt.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    }

    const { bookings, total } =
      await this.bookingRepository.findAllBookings(
        user,
        page,
        limit,
        status,
        sortBy,
        finalSortOrder,
        reviewStatus,
      );

    const formattedBookings = bookings.map((booking: Booking) => {
      const cleanCustomer = this.cleanUser(booking.customer);
      const cleanTechnician = this.cleanUser(booking.technician);

      return {
        ...booking,
        scheduledAtIst: this.toIstString(booking.scheduledAt),
        createdAtIst: this.toIstString(booking.createdAt),
        updatedAtIst: this.toIstString(booking.updatedAt),
        customer: cleanCustomer,
        technician: cleanTechnician,
      };
    });

    return {
      success: true,
      message:
        user.role === USER_ROLE.ADMIN
          ? 'Bookings fetched successfully'
          : user.role === USER_ROLE.CUSTOMER
            ? 'My bookings fetched successfully'
            : 'Assigned bookings fetched successfully',
      data: formattedBookings,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private cleanUser(user: any) {
    if (!user) return null;
    const { password, hashedRefreshToken, tokenVersion, ...safeUser } = user;
    return safeUser;
  }
  //complaint 
  async getAllComplaints(
    user: any,
    page: number,
    limit: number,
    status?: COMPLAINT_STATUS,
  ) {
    const { complaints, total } =
      await this.complaintRepository.findAllComplaints(
        user,
        page,
        limit,
        status,
      );

    const totalPages = Math.ceil(total / limit);

    const formattedComplaints = await Promise.all(
      complaints.map(async (complaint) => {
        let iconDownloadUrl;
        if (complaint.booking?.service?.iconUrl) {
          iconDownloadUrl = await this.s3Service.getDownloadUrl(
            complaint.booking.service.iconUrl,
          );
        }

        const service = complaint.booking?.service
          ? {
            ...complaint.booking.service,
            iconDownloadUrl,
          }
          : null;

        const cleanCustomer = this.cleanUser(complaint.booking?.customer);
        const cleanTechnician = this.cleanUser(complaint.booking?.technician);

        return {
          id: complaint.id,
          title: complaint.title,
          description: complaint.description,
          status: complaint.status,

          createdBy: complaint.createdByUser
            ? {
              id: complaint.createdByUser.id,
              firstName: complaint.createdByUser.firstName,
              lastName: complaint.createdByUser.lastName,
              username: complaint.createdByUser.username,
              role: complaint.createdByUser.role,
            }
            : null,

          booking: complaint.booking
            ? {
              id: complaint.booking.id,
              status: complaint.booking.status,
              paymentStatus: complaint.booking.paymentStatus,
              reviewStatus: complaint.booking.reviewStatus,
              customerRating: complaint.booking.customerRating,
              customerReview: complaint.booking.customerReview,
              technicianRating: complaint.booking.technicianRating,
              technicianReview: complaint.booking.technicianReview,
              isEmergency: complaint.booking.isEmergency,
              scheduledAt: complaint.booking.scheduledAt,
              scheduledAtIst: this.toIstString(complaint.booking.scheduledAt),
              totalAmount: complaint.booking.totalAmount,
              priceBreakdown: complaint.booking.priceBreakdown,
              customer: cleanCustomer,
              technician: cleanTechnician,
              address: complaint.booking.address ?? null,
              createdAt: complaint.booking.createdAt,
              createdAtIst: this.toIstString(complaint.booking.createdAt),
            }
            : null,

          service,

          createdAt: complaint.createdAt,
          updatedAt: complaint.updatedAt,
        };
      }),
    );

    return {
      success: true,
      message:
        total === 0
          ? user.role === USER_ROLE.ADMIN
            ? 'No complaints found.'
            : 'You have not raised any complaints yet.'
          : 'Complaints fetched successfully',

      data: formattedComplaints,

      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  // Complaint By ID
  async getComplaintById(id: number, user?: any) {
    const complaint =
      await this.complaintRepository.findComplaintById(
        id,
      );

    if (!complaint) {
      throw new NotFoundException(
        'Complaint not found',
      );
    }

    if (user && user.role !== USER_ROLE.ADMIN) {
      const isCreator = complaint.createdBy === user.id;
      const isCustomer = complaint.booking?.customerId === user.id;
      const isTechnician = complaint.booking?.technicianId === user.id;

      if (!isCreator && !isCustomer && !isTechnician) {
        throw new ForbiddenException(
          'You are not authorized to view this complaint',
        );
      }
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
    dto: AssignBookingDto,) {
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

    // Check if technician actually provides the booked service
    const technicianProvidesService = technician.technicianProfile?.services?.some(
      (ts) => ts.serviceId === booking.serviceId,
    );

    if (!technicianProvidesService) {
      throw new BadRequestException(
        `Technician does not provide the service requested in this booking`,
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

  async cancelBooking(user: any, dto: CancelBookingDto) {
    const { bookingId } = dto;

    const booking = await this.bookingRepository.findBookingById(bookingId);

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.status === BOOKING_STATUS.COMPLETED) {
      throw new BadRequestException('Completed booking cannot be cancelled');
    }

    if (booking.status === BOOKING_STATUS.CANCELLED) {
      throw new BadRequestException('Booking already cancelled');
    }

    let updateData: Partial<Booking>;

    switch (user.role) {
      case USER_ROLE.CUSTOMER: {
        if (booking.customerId !== user.id) {
          throw new ForbiddenException(
            'You are not allowed to cancel this booking',
          );
        }

        if (!dto.cancellationReason) {
          throw new BadRequestException('Cancellation reason is required');
        }

        updateData = {
          status: BOOKING_STATUS.CANCELLED,
          cancelledBy: user.id,
          cancellationReason: dto.cancellationReason,
        };

        break;
      }

      case USER_ROLE.TECHNICIAN: {
        if (!booking.technician || booking.technician.id !== user.id) {
          throw new ForbiddenException(
            'You are not assigned to this booking',
          );
        }

        if (booking.status !== BOOKING_STATUS.ACCEPTED) {
          throw new BadRequestException(
            'Only accepted booking can be cancelled by technician',
          );
        }

        updateData = {
          status: BOOKING_STATUS.PENDING,
          technicianId: null as any,
          cancelledBy: user.id,
          cancellationReason: '',
        };

        break;
      }

      default:
        throw new ForbiddenException(
          'You are not allowed to cancel this booking',
        );
    }

    const updated =
      await this.bookingRepository.updateBookingCancelFields(
        booking.id,
        updateData,
      );

    if (!updated) {
      throw new NotFoundException('Booking not found after update');
    }

    return {
      message:
        user.role === USER_ROLE.CUSTOMER
          ? 'Booking cancelled successfully'
          : 'Booking released successfully',

      data: {
        bookingId: updated.id,
        status: updated.status,
        technicianId: updated.technicianId ?? null,
        cancelledBy: updated.cancelledBy,
        cancelledByRole: user.role,
        cancellationReason:
          user.role === USER_ROLE.CUSTOMER
            ? updated.cancellationReason
            : '-',
        updatedAt: updated.updatedAt,
      },
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

    const createdAtTime = new Date(complaint.createdAt).getTime();
    const currentTime = new Date().getTime();

    if (currentTime - createdAtTime > 10 * 60 * 1000) {
      throw new BadRequestException(
        'Complaint can only be edited within 10 minutes of creation',
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
    customCallbackUrl?: string,
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
        undefined,
        customCallbackUrl,
      );

      // Save a new pending payment record in DB
      const newPayment = paymentRepo.create({
        bookingId: booking.id,
        customerId: booking.customerId,
        payBy: USER_ROLE.CUSTOMER,
        paymentType: PAYMENT_TYPE.BOOKING_PAYMENT,
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

    const event = payload?.event;

    // Handle Payout Webhooks (RazorpayX)
    if (event && event.startsWith('payout.')) {
      const payoutEntity = payload?.payload?.payout?.entity;
      const razorpayPayoutId = payoutEntity?.id;

      if (!razorpayPayoutId) {
        return { success: true, message: 'Payout event missing ID' };
      }

      const payment = await this.paymentRepository.findByRazorpayPayoutId(
        razorpayPayoutId,
      );

      if (!payment) {
        throw new NotFoundException('Payout record in payments not found');
      }

      if (event === 'payout.processed') {
        payment.status = PAYMENT_STATUS.SUCCESS;
        payment.utr = payoutEntity.utr || payment.utr;
      } else if (event === 'payout.reversed' || event === 'payout.failed') {
        payment.status =
          event === 'payout.reversed'
            ? PAYMENT_STATUS.REVERSED
            : PAYMENT_STATUS.FAILED;
        payment.errorMessage =
          payoutEntity.status_details?.description ||
          payoutEntity.failure_reason ||
          `Payout ${event}`;
      } else if (event === 'payout.updated') {
        if (payoutEntity.status === 'processed') {
          payment.status = PAYMENT_STATUS.SUCCESS;
          payment.utr = payoutEntity.utr || payment.utr;
        } else if (payoutEntity.status === 'reversed') {
          payment.status = PAYMENT_STATUS.REVERSED;
        } else if (payoutEntity.status === 'failed') {
          payment.status = PAYMENT_STATUS.FAILED;
        }
      }

      await this.paymentRepository.updatePayment(payment);

      return {
        success: true,
        message: `Payout event ${event} processed successfully`,
        data: payment,
      };
    }

    // Handle Customer Payment Link Webhooks (Razorpay Standard)
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

    if (payment.booking) {
      payment.booking.paymentStatus =
        BOOKING_PAYMENT_STATUS.PAID;

      await this.bookingRepository.saveBooking(
        payment.booking,
      );
    } else {
      if (payment.customerId) {
        const userRepo = this.dataSource.getRepository(User);
        const user = await userRepo.findOne({
          where: { id: payment.customerId },
        });
        if (user) {
          user.isTokenPaid = true;
          user.paymentId = payment.id;
          await userRepo.save(user);
        }
      }
    }

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

    const payoutAccount = await this.dataSource.getRepository(TechnicianPayoutAccount).findOne({
      where: { technicianId: technician.id },
    });

    if (!payoutAccount || !payoutAccount.razorpayFundAccountId) {
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
      await this.paymentRepository.findExistingPayout(
        booking.id,
        technician.id,
      );

    if (
      existingPayout &&
      [
        PAYMENT_STATUS.PENDING,
        PAYMENT_STATUS.PROCESSING,
        PAYMENT_STATUS.SUCCESS,
      ].includes(existingPayout.status)
    ) {
      throw new BadRequestException(
        'An active or successful payout already exists',
      );
    }

    const idempotencyKey = randomUUID();

    const payout = await this.paymentRepository.createPayment({
      bookingId: booking.id,
      technicianId: technician.id,
      payoutBy: adminId,
      payBy: USER_ROLE.ADMIN,
      paymentType: PAYMENT_TYPE.TECHNICIAN_PAYOUT,
      amount: payoutAmount,
      currency: 'INR',
      idempotencyKey,
      status: PAYMENT_STATUS.PENDING,
    });

    try {
      const razorpayPayout =
        await this.razorpayXService.createPayout({
          fundAccountId: payoutAccount.razorpayFundAccountId,
          amount: payoutAmount,
          bookingId: booking.id,
          technicianId: technician.id,
          internalPayoutId: payout.id,
          idempotencyKey,
        });

      payout.razorpayPayoutId = razorpayPayout.id;

      if (razorpayPayout.status === 'processed') {
        payout.status = PAYMENT_STATUS.SUCCESS;
        payout.utr = razorpayPayout.utr || undefined;
      } else if (razorpayPayout.status === 'failed') {
        payout.status = PAYMENT_STATUS.FAILED;
        payout.errorMessage =
          razorpayPayout.status_details?.description ||
          'RazorpayX payout failed';
      } else {
        payout.status = PAYMENT_STATUS.PROCESSING;
      }

      await this.paymentRepository.updatePayment(payout);

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
      payout.status = PAYMENT_STATUS.FAILED;
      payout.errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to initiate technician payout';

      await this.paymentRepository.updatePayment(payout);

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

  async getTechnicianReviews(
    technicianId: number,
    page = 1,
    limit = 10,
  ) {
    const { reviews, total } =
      await this.bookingRepository.findTechnicianReviews(
        technicianId,
        page,
        limit,
      );

    const technician = reviews[0]?.technician;

    return {
      message: 'Technician reviews fetched successfully',
      data: {
        technician: technician
          ? {
            id: technician.id,
            name: `${technician.firstName} ${technician.lastName}`,
            profileImage: technician.profileImage,
            overallRating: technician.overallRating,
          }
          : null,

        reviews: reviews.map((booking) => ({
          bookingId: booking.id,
          rating: booking.customerRating,
          review: booking.customerReview,
          customer: {
            id: booking.customer?.id,
            name: `${booking.customer?.firstName} ${booking.customer?.lastName}`,
            profileImage: booking.customer?.profileImage,
          },
          service: {
            id: booking.service?.id,
            name: booking.service?.name,
          },
          createdAt: booking.updatedAt,
        })),

        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
    };
  }

  async getMyBookings(
    user: any,
    page = 1,
    limit = 10,
    status?: BOOKING_STATUS,
  ) {
    const { bookings, total } =
      await this.bookingRepository.findMyBookings(
        user.id,
        user.role,
        page,
        limit,
        status,
      );

    const data = bookings.map((booking) => {
      const commonData = {
        bookingId: booking.id,
        status: booking.status,
        paymentStatus: booking.paymentStatus,
        scheduledAt: booking.scheduledAt,
        scheduledAtIst: this.toIstString(booking.scheduledAt),
        totalAmount: booking.totalAmount,
        isEmergency: booking.isEmergency,
        cancellationReason: booking.cancellationReason,

        service: booking.service
          ? {
            id: booking.service.id,
            name: booking.service.name,
            description: booking.service.description,
            iconUrl: booking.service.iconUrl,
          }
          : null,

        address: booking.address
          ? {
            fullAddress: booking.address.fullAddress,
            city: booking.address.city,
            state: booking.address.state,
            pincode: booking.address.pincode,
            label: booking.address.label,
          }
          : null,

        // createdAt: booking.createdAt,
        // updatedAt: booking.updatedAt,
        createdAt: booking.createdAt,
        createdAtIst: this.toIstString(booking.createdAt),

        updatedAt: booking.updatedAt,
        updatedAtIst: this.toIstString(booking.updatedAt),
      };

      if (user.role === USER_ROLE.CUSTOMER) {
        return {
          ...commonData,

          technician: booking.technician
            ? {
              id: booking.technician.id,
              name: `${booking.technician.firstName} ${booking.technician.lastName}`,
              profileImage: booking.technician.profileImage,
              overallRating: booking.technician.overallRating,
            }
            : null,

          customerRating: booking.customerRating,
          customerReview: booking.customerReview,
        };
      }

      if (user.role === USER_ROLE.TECHNICIAN) {
        return {
          ...commonData,

          customer: booking.customer
            ? {
              id: booking.customer.id,
              name: `${booking.customer.firstName} ${booking.customer.lastName}`,
              profileImage: booking.customer.profileImage,
              phone: booking.customer.phone,
            }
            : null,

          technicianRating: booking.technicianRating,
          technicianReview: booking.technicianReview,
        };
      }

      return commonData;
    });

    return {
      success: true,
      message: 'My bookings fetched successfully',
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getMyReviews(user: any, page = 1, limit = 10) {
    const { reviews, total } =
      user.role === USER_ROLE.ADMIN
        ? await this.bookingRepository.findAllReviews(page, limit)
        : await this.bookingRepository.findMyReviews(
          user.id,
          user.role,
          page,
          limit,
        );

    const formattedReviews = reviews.map((booking) => {
      const isCustomer = user.role === USER_ROLE.CUSTOMER;
      const isAdmin = user.role === USER_ROLE.ADMIN;

      if (isAdmin) {
        return {
          bookingId: booking.id,

          service: booking.service
            ? {
              id: booking.service.id,
              name: booking.service.name,
            }
            : null,

          customerReview: {
            reviewFor: {
              id: booking.customer?.id,
              name: `${booking.customer?.firstName} ${booking.customer?.lastName}`,
              profileImage: booking.customer?.profileImage,
            },
            reviewer: {
              id: booking.technician?.id,
              name: `${booking.technician?.firstName} ${booking.technician?.lastName}`,
              profileImage: booking.technician?.profileImage,
            },
            rating: booking.customerRating,
            review: booking.customerReview,
          },

          technicianReview: {
            reviewFor: {
              id: booking.technician?.id,
              name: `${booking.technician?.firstName} ${booking.technician?.lastName}`,
              profileImage: booking.technician?.profileImage,
            },
            reviewer: {
              id: booking.customer?.id,
              name: `${booking.customer?.firstName} ${booking.customer?.lastName}`,
              profileImage: booking.customer?.profileImage,
            },
            rating: booking.technicianRating,
            review: booking.technicianReview,
          },

          reviewedAt: booking.updatedAt,
        };
      }

      return {
        bookingId: booking.id,

        service: booking.service
          ? {
            id: booking.service.id,
            name: booking.service.name,
          }
          : null,

        reviewer: isCustomer
          ? {
            id: booking.technician?.id,
            name: `${booking.technician?.firstName} ${booking.technician?.lastName}`,
            profileImage: booking.technician?.profileImage,
          }
          : {
            id: booking.customer?.id,
            name: `${booking.customer?.firstName} ${booking.customer?.lastName}`,
            profileImage: booking.customer?.profileImage,
          },

        rating: isCustomer
          ? booking.technicianRating
          : booking.customerRating,

        review: isCustomer
          ? booking.technicianReview
          : booking.customerReview,

        reviewedAt: booking.updatedAt,
      };
    });

    return {
      reviews: formattedReviews,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async resolveComplaintService(complaintId: number) {
    const complaint =
      await this.complaintRepository.findComplaintById(complaintId);

    if (!complaint) {
      throw new NotFoundException('Complaint not found');
    }

    if (complaint.status === COMPLAINT_STATUS.RESOLVED) {
      throw new BadRequestException('Complaint is already resolved');
    }

    const updatedComplaint =
      await this.complaintRepository.updateComplaintStatus(
        complaint,
        COMPLAINT_STATUS.RESOLVED,
      );

    return {
      success: true,
      message: 'Complaint resolved successfully',
      data: updatedComplaint,
    };
  }

  async deleteComplaint(id: number) {
    const complaint =
      await this.complaintRepository.findComplaintById(id);

    if (!complaint) {
      throw new NotFoundException('Complaint not found');
    }

    await this.complaintRepository.deleteComplaintById(id);

    return {
      success: true,
      message: 'Complaint deleted permanently',
    };
  }

  async adminCreateBooking(dto: AdminCreateBookingDto): Promise<any> {
    const targetDate = new Date(dto.scheduledAt);
    if (Number.isNaN(targetDate.getTime())) {
      throw new BadRequestException('Invalid scheduledAt date');
    }
    if (targetDate.getTime() < Date.now()) {
      throw new BadRequestException('Scheduled date and time cannot be in the past');
    }

    return this.dataSource.transaction(async (manager) => {
      const customer = await manager.getRepository(User).findOne({
        where: { id: dto.customerId, role: USER_ROLE.CUSTOMER },
      });
      if (!customer) {
        throw new NotFoundException('Customer not found or not a customer');
      }

      const technician = await manager.getRepository(User).findOne({
        where: {
          id: dto.technicianId,
          role: USER_ROLE.TECHNICIAN,
        },
        relations: [
          'technicianProfile',
          'technicianProfile.services',
          'technicianProfile.services.service',
          'technicianProfile.services.service.specifications',
        ],
      });
      if (!technician) {
        throw new NotFoundException('Technician not found or not a technician');
      }
      if (!technician.technicianProfile) {
        throw new BadRequestException('Technician profile is not available');
      }
      if (technician.technicianProfile.status !== TECHNICIAN_STATUS.APPROVED
      ) {
        throw new BadRequestException('Only approved technicians can be assigned to a booking',);
      }

      const service = await manager.getRepository(Service).findOne({
        where: { id: dto.serviceId, isActive: true },
        relations: ['specifications', 'pricingRule'],
      });
      if (!service) {
        throw new NotFoundException('Service not found or inactive');
      }
      if (!service.pricingRule) {
        throw new BadRequestException('Pricing rules are not configured for this service');
      }

      const technicianService =
        technician.technicianProfile.services?.find(
          technicianService =>
            technicianService.serviceId === dto.serviceId || technicianService.service?.id === dto.serviceId,
        );
      if (!technicianService) {
        throw new BadRequestException(`Technician does not provide the selected service: ${service.name}`);
      }

      const address = await manager.getRepository(CustomerAddress).findOne({
        where: { id: dto.customerAddressId, userId: dto.customerId, isActive: true },
      });
      if (!address) {
        throw new NotFoundException('Address not found or does not belong to this customer');
      }

      // Check technician schedule conflict
      const conflictingBooking = await manager.getRepository(Booking).findOne({
        where: {
          technicianId: dto.technicianId,
          scheduledAt: dto.scheduledAt,
          status: Not(BOOKING_STATUS.CANCELLED),
        },
      });
      if (conflictingBooking) {
        throw new BadRequestException('Technician is already booked at the given date and time');
      }

      const dbSpecs = service.specifications || [];
      const userSpecs = dto.serviceSpecifications || [];
      const dbSpecsMap = new Map(dbSpecs.map((s) => [s.id, s]));

      // Validate specifications
      for (const uSpec of userSpecs) {
        const dbSpec = dbSpecsMap.get(uSpec.specificationId);
        if (!dbSpec || !dbSpec.isActive) {
          throw new BadRequestException(
            `Specification ID ${uSpec.specificationId} is not valid for this service`,
          );
        }
        uSpec.name = dbSpec.name;
      }

      const serviceSpecifications = userSpecs.map((uSpec) => ({
        specificationId: uSpec.specificationId,
        value: uSpec.value,
      }));

      // Calculate Fare and Breakdown
      const pricingRule = service.pricingRule;
      const serviceBasePrice = Number(pricingRule.serviceBasePrice);

      const targetDate = new Date(dto.scheduledAt);
      const { weekday, hour } = this.getIstDateParts(targetDate);
      const isWeekend = weekday === 'Sat' || weekday === 'Sun';

      const weekendMultiplier = isWeekend ? Number(pricingRule.weekendMultiplier) : 1.0;
      let isPeakHour = false;
      if (pricingRule.peakHours && Array.isArray(pricingRule.peakHours)) {
        for (const range of pricingRule.peakHours) {
          if (hour >= range.start && hour <= range.end) {
            isPeakHour = true;
            break;
          }
        }
      }
      const peakHourMultiplier = isPeakHour ? Number(pricingRule.peakHourMultiplier) : 1.0;
      const surgeMultiplier = pricingRule.isSurgeEnabled ? Number(pricingRule.surgeFactor) : 1.0;

      const weekendCharge = pricingRule.isWeekendApplied && isWeekend
        ? Number((serviceBasePrice * (weekendMultiplier - 1)).toFixed(2))
        : 0;
      const peakHourCharge = pricingRule.isPeakHourApplied && isPeakHour
        ? Number((serviceBasePrice * (peakHourMultiplier - 1)).toFixed(2))
        : 0;
      const surgeCharge = pricingRule.isSurgeEnabled
        ? Number((serviceBasePrice * (surgeMultiplier - 1)).toFixed(2))
        : 0;
      const emergencyCharge = pricingRule.isEmergencyApplied && dto.isEmergency
        ? Number(pricingRule.emergencyCharge)
        : 0;
      const distanceCharge = 0;

      const subtotal = serviceBasePrice + weekendCharge + peakHourCharge + surgeCharge + emergencyCharge + distanceCharge;
      const platformFee = pricingRule.isPlatformFeeApplied ? Number(pricingRule.platformFee) : 0;
      const gstRate = Number(pricingRule.gst) / 100;
      const gst = pricingRule.isGstApplied ? Number(((subtotal + platformFee) * gstRate).toFixed(2)) : 0;

      const totalAmount = Number((subtotal + platformFee + gst).toFixed(2));
      if (totalAmount < serviceBasePrice) {
        throw new BadRequestException('Calculation error: Total amount must be greater than base price.');
      }

      const commissionRate = 0.15;
      const platformCommission = Number((subtotal * commissionRate).toFixed(2));
      const platformEarning = Number((platformFee + platformCommission).toFixed(2));
      const technicianEarning = Number((subtotal - platformCommission).toFixed(2));

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

      const booking = manager.getRepository(Booking).create({
        customerId: dto.customerId,
        technicianId: dto.technicianId,
        serviceId: dto.serviceId,
        addressId: dto.customerAddressId,
        serviceSpecifications: serviceSpecifications as any,
        isEmergency: dto.isEmergency ?? false,
        scheduledAt: targetDate,
        status: BOOKING_STATUS.ACCEPTED, // Pre-assigned by Admin
        totalAmount,
        priceBreakdown,
        isManualAssign: true,
      });

      return manager.getRepository(Booking).save(booking);
    });
  }

  async getActiveBookingForTechnician(
    technicianId: number,
    page: number = 1,
    limit: number = 10,
  ) {
    const { bookings, total } =
      await this.bookingRepository.findActiveBookingsForTechnician(
        technicianId,
        page,
        limit,
      );

    const formattedBookings = bookings.map((booking) => ({
      id: booking.id,
      status: booking.status,
      isManualAssign: booking.isManualAssign,
      serviceId: booking.serviceId,
      customerId: booking.customerId,
      addressId: booking.addressId,

      customer: booking.customer
        ? {
          id: booking.customer.id,
          firstName: booking.customer.firstName,
          lastName: booking.customer.lastName,
          email: booking.customer.email,
          phone: booking.customer.phone,
          profileImage: booking.customer.profileImage,
        }
        : null,

      service: booking.service
        ? {
          id: booking.service.id,
          name: booking.service.name,
          iconUrl: booking.service.iconUrl,
        }
        : null,

      address: booking.address
        ? {
          id: booking.address.id,
          fullAddress: booking.address.fullAddress,
          city: booking.address.city,
          state: booking.address.state,
          pincode: booking.address.pincode,
          latitude: booking.address.latitude,
          longitude: booking.address.longitude,
        }
        : null,

      scheduledAt: booking.scheduledAt ?? null,
      totalAmount: booking.totalAmount ?? null,
      priceBreakdown: booking.priceBreakdown ?? null,
      serviceSpecifications: booking.serviceSpecifications ?? null,
      createdAt: booking.createdAt,
    }));

    return {
      success: true,
      message: 'Active technician bookings fetched successfully',
      data: formattedBookings,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async adminUpdateBookingReview(
    bookingId: number,
    dto: AdminUpdateBookingReviewDto,
  ) {
    const booking = await this.bookingRepository.findBookingById(bookingId);

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    const updateFields: any = {};

    if (dto.customerRating !== undefined) {
      updateFields.customerRating = dto.customerRating;
    }

    if (dto.customerReview !== undefined) {
      updateFields.customerReview = dto.customerReview;
    }

    if (dto.technicianRating !== undefined) {
      updateFields.technicianRating = dto.technicianRating;
    }

    if (dto.technicianReview !== undefined) {
      updateFields.technicianReview = dto.technicianReview;
    }

    if (dto.reviewStatus !== undefined) {
      updateFields.reviewStatus = dto.reviewStatus;
    }

    if (Object.keys(updateFields).length > 0) {
      await this.dataSource
        .getRepository(Booking)
        .update(bookingId, updateFields);
    }

    const updatedBooking = await this.bookingRepository.findBookingById(
      bookingId,
    );

    return {
      success: true,
      message: 'Booking review details updated successfully',
      data: updatedBooking,
    };
  }

  async getPublicReviews(
    page = 1,
    limit = 10,
    reviewStatus?: REVIEW_STATUS,
    serviceId?: number,
  ) {
    const { reviews, total } = await this.bookingRepository.findPublicReviews(
      page,
      limit,
      reviewStatus,
      serviceId,
    );

    const formattedReviews = await Promise.all(
      reviews.map(async (booking) => {
        let iconDownloadUrl;
        if (booking.service?.iconUrl) {
          iconDownloadUrl = await this.s3Service.getDownloadUrl(
            booking.service.iconUrl,
          );
        }

        return {
          bookingId: booking.id,

          service: booking.service
            ? {
              id: booking.service.id,
              name: booking.service.name,
              description: booking.service.description,
              iconUrl: booking.service.iconUrl,
              iconDownloadUrl,
            }
            : null,

          customer: booking.customer
            ? {
              id: booking.customer.id,
              firstName: booking.customer.firstName,
              lastName: booking.customer.lastName,
              profileImage: booking.customer.profileImage,
            }
            : null,

          technician: booking.technician
            ? {
              id: booking.technician.id,
              firstName: booking.technician.firstName,
              lastName: booking.technician.lastName,
              profileImage: booking.technician.profileImage,
            }
            : null,

          customerRating: booking.customerRating ?? null,
          customerReview: booking.customerReview ?? null,
          technicianRating: booking.technicianRating ?? null,
          technicianReview: booking.technicianReview ?? null,
          reviewStatus: booking.reviewStatus,
          createdAt: booking.createdAt,
          updatedAt: booking.updatedAt,
        };
      }),
    );

    return {
      success: true,
      message: 'Public reviews fetched successfully',
      data: formattedReviews,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}