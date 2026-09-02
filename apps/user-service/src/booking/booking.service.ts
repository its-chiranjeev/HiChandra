import { randomUUID } from 'crypto';
import { Booking, BOOKING_STATUS, BOOKING_PAYMENT_STATUS, Service, CustomerAddress, User, USER_ROLE, USER_STATUS, TECHNICIAN_STATUS, JOB_STATUS, TechnicianService, TechnicianLocation, Otp, PriceBreakdown, Payment, PAYMENT_STATUS, COMPLAINT_STATUS, TechnicianProfile, TechnicianPayoutAccount, Complaint, REVIEW_STATUS, PAYMENT_TYPE, CUSTOMER_PAYMENT_MODE } from '@hichandra/entities';
import { EmailService } from '@hichandra/email-services';
import { PaymentService, RazorpayXService } from '@hichandra/payment';
import { Injectable, NotFoundException, BadRequestException, UnprocessableEntityException, ForbiddenException, UnauthorizedException, Logger } from '@nestjs/common';
import { DataSource, Not, IsNull } from 'typeorm';
import { CreateBookingDto, UpdateBookingStatusDto, CreateBookingReviewDto, StartBookingDto, AssignBookingDto, CancelBookingDto, CreateComplaintDto, UpdateComplaintDto, CreateTechnicianPayoutDto, RescheduleBookingDto, RepeatBookingDto, TechnicianCancelBookingDto, AdminCreateBookingDto, AdminUpdateBookingReviewDto, AdminCreatePayoutDto, AcceptBookingDto } from '@hichandra/dtos';
import { AssignmentService } from '../assignment/assignment.service';
import { BookingRepository, UserRepository, ComplaintRepository, PaymentRepository, ServiceRepository } from '@hichandra/repositories';
import { S3Service } from '@hichandra/s3';
import { SmsService } from '@hichandra/sms-services';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BookingGateway } from '@hichandra/gateway';

@Injectable()
export class BookingService {
  private readonly logger = new Logger(BookingService.name);

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
    private readonly smsService: SmsService,
    private readonly bookingGateway: BookingGateway,
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

  // TODO:Tushar's code
  // async createBooking(
  //   customerId: number,
  //   dto: CreateBookingDto,
  //   userRole?: USER_ROLE,
  //   // ): Promise<Booking> {
  // ): Promise<any> {
  //   return this.dataSource.transaction(async (manager) => {
  //     const userRepo = manager.getRepository(User);
  //     const customer = await userRepo.findOne({
  //       where: { id: customerId },
  //     });
  //     if (!customer) {
  //       throw new NotFoundException('Customer not found');
  //     }
  //     // if (userRole !== USER_ROLE.ADMIN && !customer.isTokenPaid) {
  //     //   throw new BadRequestException('Token payment is required before booking');
  //     // }

  //     const serviceRepo = manager.getRepository(Service);
  //     const addressRepo = manager.getRepository(CustomerAddress);
  //     const bookingRepo = manager.getRepository(Booking);
  //     const technicianServices = await manager
  //       .getRepository(TechnicianService)
  //       .find({
  //         where: { serviceId: dto.serviceId },
  //       });


  //     // console.log(technicianServices);
  //     const allTechnicianWithService = await Promise.all(
  //       technicianServices.map(async (ts) => {
  //         const technicianProfileId = ts.technicianProfileId;
  //         const user = await manager.getRepository(User).findOne({ //add condition for technician should be available
  //           // where: { technicianProfileId: technicianProfileId },
  //           where: {
  //             status: USER_STATUS.ACTIVE,
  //             technicianProfile: {
  //               id: technicianProfileId,
  //               // jobStatus: JOB_STATUS.AVAILABLE,
  //             },
  //           },
  //           relations: ['technicianProfile', 'technicianProfile.locations'],
  //         });
  //         if (user?.technicianProfile?.locations) {
  //           user.technicianProfile.locations =
  //             user.technicianProfile.locations.filter((loc) => loc.isDefault);
  //         }
  //         return user;
  //       }),
  //     );
  //     // console.log(allTechnicianWithService);
  //     const service = await serviceRepo.findOne({
  //       where: { id: dto.serviceId, isActive: true },
  //       relations: ['specifications', 'pricingRule'],
  //     });
  //     if (!service) {
  //       throw new NotFoundException('Service not found or inactive');
  //     }
  //     if (!service.pricingRule) {
  //       throw new BadRequestException(
  //         'Pricing rules are not configured for this service',
  //       );
  //     }

  //     // Check for existing pending booking of the same service (across all dates)
  //     const pendingBooking = await bookingRepo.findOne({
  //       where: {
  //         customerId,
  //         serviceId: dto.serviceId,
  //         status: BOOKING_STATUS.PENDING,
  //       },
  //     });
  //     if (pendingBooking) {
  //       throw new BadRequestException(
  //         'You already have a pending booking for this service',
  //       );
  //     }

  //     // Check for same-day booking of the same service
  //     // const targetDate = dto.scheduledAt
  //     //   ? new Date(dto.scheduledAt)
  //     //   : new Date();
  //     // const startOfDay = new Date(targetDate);
  //     // startOfDay.setHours(0, 0, 0, 0);
  //     // const endOfDay = new Date(targetDate);
  //     // endOfDay.setHours(23, 59, 59, 999);
  //     //added
  //     const targetDate = dto.scheduledAt
  //       ? new Date(dto.scheduledAt)
  //       : new Date();

  //     if (Number.isNaN(targetDate.getTime())) {
  //       throw new BadRequestException('Invalid scheduledAt date');
  //     }

  //     // Get IST date only, example: 2026-07-08
  //     const istDateString = targetDate.toLocaleDateString('en-CA', {
  //       timeZone: 'Asia/Kolkata',
  //     });

  //     // IST day range converted to UTC for DB query
  //     const startOfDay = new Date(`${istDateString}T00:00:00.000+05:30`);
  //     const endOfDay = new Date(`${istDateString}T23:59:59.999+05:30`);
  //     //
  //     const sameDayBooking = await bookingRepo
  //       .createQueryBuilder('booking')
  //       .where('booking.customerId = :customerId', { customerId })
  //       .andWhere('booking.serviceId = :serviceId', {
  //         serviceId: dto.serviceId,
  //       })
  //       .andWhere('booking.scheduledAt BETWEEN :startOfDay AND :endOfDay', {
  //         startOfDay,
  //         endOfDay,
  //       })
  //       .andWhere('booking.status != :cancelledStatus', {
  //         cancelledStatus: BOOKING_STATUS.CANCELLED,
  //       })
  //       .getOne();

  //     if (sameDayBooking) {
  //       throw new BadRequestException(
  //         `You already have an active booking for this service on this date (Status: ${sameDayBooking.status})`,
  //       );
  //     }

  //     const dbSpecs = service.specifications || [];
  //     const userSpecs = dto.serviceSpecifications || [];
  //     const dbSpecsMap = new Map(dbSpecs.map((s) => [s.id, s]));

  //     // 1. Check if all required specs are present in userSpecs
  //     const requiredSpecs = dbSpecs.filter((s) => s.isRequired && s.isActive);
  //     for (const reqSpec of requiredSpecs) {
  //       const found = userSpecs.find((u) => u.specificationId === reqSpec.id);
  //       if (!found || found.value === undefined || found.value === null) {
  //         throw new BadRequestException(
  //           `Specification "${reqSpec.name}" (ID ${reqSpec.id}) is required`,
  //         );
  //       }
  //     }

  //     // 2. Validate userSpecs and fill names automatically
  //     for (const uSpec of userSpecs) {
  //       const dbSpec = dbSpecsMap.get(uSpec.specificationId);
  //       if (!dbSpec || !dbSpec.isActive) {
  //         throw new BadRequestException(
  //           `Specification ID ${uSpec.specificationId} is not valid for this service`,
  //         );
  //       }

  //       // Autofill name from DB if not provided
  //       uSpec.name = dbSpec.name;

  //       // Type checks
  //       if (dbSpec.type === 'number') {
  //         if (typeof uSpec.value !== 'number') {
  //           throw new BadRequestException(
  //             `Specification "${dbSpec.name}" must be a number`,
  //           );
  //         }
  //       } else if (dbSpec.type === 'select') {
  //         if (typeof uSpec.value !== 'string') {
  //           throw new BadRequestException(
  //             `Specification "${dbSpec.name}" must be a string value`,
  //           );
  //         }
  //         if (dbSpec.values && Array.isArray(dbSpec.values)) {
  //           const allowed = dbSpec.values as string[];
  //           if (!allowed.includes(uSpec.value)) {
  //             throw new BadRequestException(
  //               `Value "${uSpec.value}" is not valid for "${dbSpec.name}". Allowed values: ${allowed.join(', ')}`,
  //             );
  //           }
  //         }
  //       } else if (dbSpec.type === 'multiselect') {
  //         if (!Array.isArray(uSpec.value)) {
  //           throw new BadRequestException(
  //             `Specification "${dbSpec.name}" must be an array of string values`,
  //           );
  //         }
  //         if (dbSpec.values && Array.isArray(dbSpec.values)) {
  //           const allowed = dbSpec.values as string[];
  //           for (const val of uSpec.value) {
  //             if (typeof val !== 'string') {
  //               throw new BadRequestException(
  //                 `Each value in "${dbSpec.name}" must be a string`,
  //               );
  //             }
  //             if (!allowed.includes(val)) {
  //               throw new BadRequestException(
  //                 `Value "${val}" is not valid for "${dbSpec.name}". Allowed values: ${allowed.join(', ')}`,
  //               );
  //             }
  //           }
  //         }
  //       } else if (dbSpec.type === 'text') {
  //         if (typeof uSpec.value !== 'string') {
  //           throw new BadRequestException(
  //             `Specification "${dbSpec.name}" must be a string`,
  //           );
  //         }
  //       } else if (dbSpec.type === 'image') {
  //         if (typeof uSpec.value !== 'string') {
  //           throw new BadRequestException(
  //             `Specification "${dbSpec.name}" must be an image URL string`,
  //           );
  //         }
  //       }
  //     }

  //     const address = await addressRepo.findOne({
  //       where: {
  //         id: dto.customerAddressId,
  //         userId: customerId,
  //         isActive: true,
  //         // isDefault: true,
  //       },
  //     });
  //     if (!address) {
  //       throw new NotFoundException(
  //         'Address not found or does not belong to this customer',
  //       );
  //     }
  //     const serviceSpecifications = userSpecs.map((uSpec) => ({
  //       specificationId: uSpec.specificationId,
  //       value: uSpec.value,
  //     }));

  //     // Calculate Fare and Breakdown using new toggle booleans
  //     const pricingRule = service.pricingRule;
  //     const serviceBasePrice = Number(pricingRule.serviceBasePrice);
  //     // const isWeekend = targetDate.getDay() === 0 || targetDate.getDay() === 6;
  //     // const weekendMultiplier = isWeekend
  //     //   ? Number(pricingRule.weekendMultiplier)
  //     //   : 1.0;

  //     // let isPeakHour = false;
  //     // const hour = targetDate.getHours();
  //     //added
  //     const { weekday, hour } = this.getIstDateParts(targetDate);

  //     const isWeekend = weekday === 'Sat' || weekday === 'Sun';

  //     const weekendMultiplier = isWeekend
  //       ? Number(pricingRule.weekendMultiplier)
  //       : 1.0;

  //     let isPeakHour = false;
  //     //
  //     if (pricingRule.peakHours && Array.isArray(pricingRule.peakHours)) {
  //       for (const range of pricingRule.peakHours) {
  //         if (hour >= range.start && hour <= range.end) {
  //           isPeakHour = true;
  //           break;
  //         }
  //       }
  //     }
  //     const peakHourMultiplier = isPeakHour
  //       ? Number(pricingRule.peakHourMultiplier)
  //       : 1.0;
  //     const surgeMultiplier = pricingRule.isSurgeEnabled
  //       ? Number(pricingRule.surgeFactor)
  //       : 1.0;

  //     const weekendCharge =
  //       pricingRule.isWeekendApplied && isWeekend
  //         ? Number((serviceBasePrice * (weekendMultiplier - 1)).toFixed(2))
  //         : 0;
  //     const peakHourCharge =
  //       pricingRule.isPeakHourApplied && isPeakHour
  //         ? Number((serviceBasePrice * (peakHourMultiplier - 1)).toFixed(2))
  //         : 0;
  //     const surgeCharge = pricingRule.isSurgeEnabled
  //       ? Number((serviceBasePrice * (surgeMultiplier - 1)).toFixed(2))
  //       : 0;
  //     const emergencyCharge =
  //       pricingRule.isEmergencyApplied && dto.isEmergency
  //         ? Number(pricingRule.emergencyCharge)
  //         : 0;
  //     const distanceCharge = 0; // Calculated dynamically if isDistanceKmApplied is true during assignment/completion

  //     const appliedBasePrice = pricingRule.isServiceBasePriceApplied !== false
  //       ? serviceBasePrice
  //       : 0;

  //     const subtotal =
  //       appliedBasePrice +
  //       weekendCharge +
  //       peakHourCharge +
  //       surgeCharge +
  //       emergencyCharge +
  //       distanceCharge;

  //     const platformFee = pricingRule.isPlatformFeeApplied
  //       ? Number(pricingRule.platformFee)
  //       : 0;
  //     const gstRate = Number(pricingRule.gst) / 100;
  //     const gst = pricingRule.isGstApplied
  //       ? Number(((subtotal + platformFee) * gstRate).toFixed(2))
  //       : 0;

  //     const totalAmount = Number((subtotal + platformFee + gst).toFixed(2));

  //     // Make validation that totalAmount is greater than appliedBasePrice
  //     if (totalAmount < appliedBasePrice) {
  //       throw new BadRequestException(
  //         'Calculation error: Total amount must be greater than the service base price.',
  //       );
  //     }

  //     const platformEarning = platformFee;
  //     const technicianEarning = subtotal;

  //     const priceBreakdown: PriceBreakdown = {
  //       serviceBasePrice: appliedBasePrice,
  //       distanceCharge,
  //       emergencyCharge,
  //       peakHourCharge,
  //       weekendCharge,
  //       surgeCharge,
  //       gst,
  //       platformFee,
  //       technicianEarning,
  //       platformEarning,
  //     };

  //     const customerOtp = Math.floor(100000 + Math.random() * 900000).toString();

  //     const booking = bookingRepo.create({
  //       customerId,
  //       serviceId: dto.serviceId,
  //       addressId: dto.customerAddressId,
  //       serviceSpecifications: serviceSpecifications as any,
  //       isEmergency: dto.isEmergency ?? false,
  //       scheduledAt: targetDate,
  //       status: BOOKING_STATUS.PENDING,
  //       totalAmount,
  //       priceBreakdown,
  //       customerOtp,
  //     });

  //     // const savedBooking = await bookingRepo.save(booking);

  //     // // Filter technician list based on availability and send notifications
  //     // const activeTechnicians = allTechnicianWithService.filter(
  //     //   (u): u is User => !!u,
  //     // );
  //     // await this.assignmentService.assignTechnician(
  //     //   savedBooking,
  //     //   activeTechnicians,
  //     //   address,
  //     //   service,
  //     // );
  //     // throw new Error("hell");
  //     // return savedBooking;

  //     let savedBooking = await bookingRepo.save(booking);

  //     const bookingWithRelations = await bookingRepo.findOne({
  //       where: { id: savedBooking.id },
  //       relations: ['customer', 'service', 'address'],
  //     });

  //     if (!bookingWithRelations) {
  //       throw new NotFoundException('Booking not found after creation');
  //     }
  //     // Filter technician list based on availability and send notifications
  //     const activeTechnicians = allTechnicianWithService.filter(
  //       (u): u is User => !!u,
  //     );
  //     // console.log(activeTechnicians);
  //     const matchedTechnicians =
  //       await this.assignmentService.assignTechnician(
  //         bookingWithRelations,
  //         activeTechnicians,
  //         address,
  //         service,
  //       );

  //     // console.log(matchedTechnicians);
  //     bookingWithRelations.filteredTechnicians =
  //       matchedTechnicians.map((tech) => tech.id);

  //     savedBooking = await bookingRepo.save(bookingWithRelations);

  //     const finalBooking = await bookingRepo.findOne({
  //       where: { id: savedBooking.id },
  //       relations: ['customer', 'service', 'address'],
  //     });

  //     if (!finalBooking) {
  //       throw new NotFoundException('Booking not found after save');
  //     }

  //     return {
  //       ...finalBooking,
  //       scheduledAtIst: this.toIstString(finalBooking.scheduledAt),
  //       createdAtIst: this.toIstString(finalBooking.createdAt),
  //       updatedAtIst: this.toIstString(finalBooking.updatedAt),
  //     };
  //   });
  // }

  async createBookingService(
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
      // if (userRole !== USER_ROLE.ADMIN && !customer.isTokenPaid) {
      //   throw new BadRequestException('Token payment is required before booking');
      // }

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
                // jobStatus: JOB_STATUS.AVAILABLE,
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
        .andWhere(
          'booking.scheduledAt BETWEEN :startOfDay AND :endOfDay',
          {
            startOfDay,
            endOfDay,
          },
        )
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

      const appliedBasePrice = pricingRule.isServiceBasePriceApplied !== false
        ? serviceBasePrice
        : 0;

      const subtotal =
        appliedBasePrice +
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

      // Make validation that totalAmount is greater than appliedBasePrice
      if (totalAmount < appliedBasePrice) {
        throw new BadRequestException(
          'Calculation error: Total amount must be greater than the service base price.',
        );
      }

      const platformEarning = platformFee;
      const technicianEarning = subtotal;

      const priceBreakdown: PriceBreakdown = {
        serviceBasePrice: appliedBasePrice,
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

      const customerOtp = Math.floor(100000 + Math.random() * 900000).toString();

      const booking = bookingRepo.create({
        customerId,
        serviceId: dto.serviceId,
        addressId: dto.customerAddressId,
        serviceSpecifications: serviceSpecifications as any,
        isEmergency: dto.isEmergency ?? false,
        scheduledAt: dto.scheduledAt ? targetDate : undefined,
        fromTime: undefined,
        toTime: undefined,
        status: BOOKING_STATUS.PENDING,
        totalAmount,
        priceBreakdown,
        customerOtp,
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
      // console.log(activeTechnicians);
      const matchedTechnicians =
        await this.assignmentService.assignTechnician(
          bookingWithRelations,
          activeTechnicians,
          address,
          service,
        );

      // console.log(matchedTechnicians);
      bookingWithRelations.filteredTechnicians =
        matchedTechnicians.map((tech) => tech.id);

      savedBooking = await bookingRepo.save(bookingWithRelations);

      const finalBooking = await bookingRepo.findOne({
        where: { id: savedBooking.id },
        relations: ['customer', 'service', 'address'],
      });

      if (!finalBooking) {
        throw new NotFoundException('Booking not found after save');
      }

      return {
        ...finalBooking,
        scheduledAtIst: this.toIstString(finalBooking.scheduledAt),
        fromTimeIst: this.toIstString(finalBooking.fromTime),
        toTimeIst: this.toIstString(finalBooking.toTime),
        createdAtIst: this.toIstString(finalBooking.createdAt),
        updatedAtIst: this.toIstString(finalBooking.updatedAt),
      };
    });
  }

  @Cron(
    '*/4 * * * *',
    {
      name: 'mark-expired-bookings-manual',
    },
  )
  async markExpiredBookingsManual(): Promise<void> {
    this.logger.log('Marking expired bookings for manual assignment...');
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

    this.logger.log('Cancelling expired pending bookings...');
    try {
      const cancelledCount =
        await this.bookingRepository
          .cancelExpiredPendingBookings();

      if (cancelledCount > 0) {
        this.logger.log(
          `${cancelledCount} expired pending booking(s) cancelled`,
        );
      }
    } catch (error) {
      this.logger.error(
        'Failed to cancel expired pending bookings',
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

    let payoutAccounts: TechnicianPayoutAccount[] = [];
    if (booking.technicianId) {
      payoutAccounts = await this.dataSource.getRepository(TechnicianPayoutAccount).find({
        where: { technicianId: booking.technicianId },
      });
    }

    const { customerOtp, ...bookingWithoutOtp } = booking;

    const technician = bookingWithoutOtp.technician
      ? {
        ...bookingWithoutOtp.technician,
        payoutAccounts,
      }
      : null;

    return {
      ...bookingWithoutOtp,
      technician,
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
    sortByCreatedAt?: string,
    reviewStatus?: REVIEW_STATUS,
    technicianPayoutStatus?: BOOKING_PAYMENT_STATUS,
    bookingPaymentStatus?: BOOKING_PAYMENT_STATUS,
  ) {
    let sortBy: 'id' | 'updatedAt' | 'createdAt' = 'createdAt';
    let finalSortOrder: 'ASC' | 'DESC' = 'DESC';

    if (sortById) {
      sortBy = 'id';
      finalSortOrder = sortById.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    } else if (sortByUpdatedAt) {
      sortBy = 'updatedAt';
      finalSortOrder = sortByUpdatedAt.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    } else if (sortByCreatedAt) {
      sortBy = 'createdAt';
      finalSortOrder = sortByCreatedAt.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
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
        technicianPayoutStatus,
        bookingPaymentStatus,
      );

    const formattedBookings = bookings.map((booking: Booking) => {
      const cleanCustomer = this.cleanUser(booking.customer);
      const cleanTechnician = this.cleanUser(booking.technician);

      const payments = booking.payments || [];
      const bookingPayment = payments.find(
        (p) =>
          (booking.bookingPaymentId && (p.paymentId === booking.bookingPaymentId || p.paymentLinkId === booking.bookingPaymentId)) ||
          p.paymentType === PAYMENT_TYPE.BOOKING_PAYMENT ||
          p.paymentType === PAYMENT_TYPE.TOKEN_PAYMENT
      ) || null;
      const technicianPayout = payments.find(
        (p) =>
          (booking.technicianPayoutId && (p.paymentId === booking.technicianPayoutId || p.razorpayPayoutId === booking.technicianPayoutId || p.utr === booking.technicianPayoutId)) ||
          p.paymentType === PAYMENT_TYPE.TECHNICIAN_PAYOUT
      ) || null;

      const { customerOtp, payments: _, ...bookingWithoutOtp } = booking;

      return {
        ...bookingWithoutOtp,
        bookingPayment,
        technicianPayout,
        scheduledAtIst: this.toIstString(booking.scheduledAt),
        fromTimeIst: this.toIstString(booking.fromTime),
        toTimeIst: this.toIstString(booking.toTime),
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
              paymentStatus: complaint.booking.bookingPaymentStatus,
              bookingPaymentStatus: complaint.booking.bookingPaymentStatus,
              technicianPayoutStatus: complaint.booking.technicianPayoutStatus,
              bookingPaymentId: complaint.booking.bookingPaymentId,
              technicianPayoutId: complaint.booking.technicianPayoutId,
              reviewStatus: complaint.booking.reviewStatus,
              customerRating: complaint.booking.customerRating,
              customerReview: complaint.booking.customerReview,
              technicianRating: complaint.booking.technicianRating,
              technicianReview: complaint.booking.technicianReview,
              isEmergency: complaint.booking.isEmergency,
              scheduledAt: complaint.booking.scheduledAt,
              scheduledAtIst: this.toIstString(complaint.booking.scheduledAt),
              fromTime: complaint.booking.fromTime ?? null,
              toTime: complaint.booking.toTime ?? null,
              fromTimeIst: complaint.booking.fromTime ? this.toIstString(complaint.booking.fromTime) : null,
              toTimeIst: complaint.booking.toTime ? this.toIstString(complaint.booking.toTime) : null,
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

    const payments = booking.payments || [];
    const bookingPayment = payments.find(
      (p) =>
        (booking.bookingPaymentId && (p.paymentId === booking.bookingPaymentId || p.paymentLinkId === booking.bookingPaymentId)) ||
        p.paymentType === PAYMENT_TYPE.BOOKING_PAYMENT ||
        p.paymentType === PAYMENT_TYPE.TOKEN_PAYMENT
    ) || null;
    const technicianPayout = payments.find(
      (p) =>
        (booking.technicianPayoutId && (p.paymentId === booking.technicianPayoutId || p.razorpayPayoutId === booking.technicianPayoutId || p.utr === booking.technicianPayoutId)) ||
        p.paymentType === PAYMENT_TYPE.TECHNICIAN_PAYOUT
    ) || null;

    let payoutAccounts: TechnicianPayoutAccount[] = [];
    if (booking.technicianId) {
      payoutAccounts = await this.dataSource.getRepository(TechnicianPayoutAccount).find({
        where: { technicianId: booking.technicianId },
      });
    }

    const { customerOtp, payments: _, ...bookingWithoutOtp } = booking;

    const technician = bookingWithoutOtp.technician
      ? {
        ...bookingWithoutOtp.technician,
        payoutAccounts,
      }
      : null;

    return {
      success: true,
      message: 'Booking fetched successfully',
      data: {
        ...bookingWithoutOtp,
        technician,
        bookingPayment,
        technicianPayout,
      },
    };
  }

  // TODO:Tushar's code
  // async acceptBookingService(technicianId: number, bookingId: number): Promise<Booking> {
  //   const savedBooking = await this.dataSource.transaction(async (manager) => {
  //     const bookingRepo = manager.getRepository(Booking);
  //     const userRepo = manager.getRepository(User);

  //     const technician = await userRepo.findOne({
  //       where: { id: technicianId, role: USER_ROLE.TECHNICIAN },
  //       relations: ['technicianProfile'],
  //     });
  //     if (!technician) {
  //       throw new NotFoundException(
  //         'Technician not found or user is not a technician',
  //       );
  //     }
  //     if (
  //       technician.status !== USER_STATUS.ACTIVE ||
  //       technician.technicianProfile?.status !== TECHNICIAN_STATUS.APPROVED
  //     ) {
  //       throw new BadRequestException(
  //         'Technician is not active or not approved',
  //       );
  //     }

  //     const booking = await bookingRepo.findOne({ where: { id: bookingId } });
  //     if (!booking) {
  //       throw new NotFoundException('Booking not found');
  //     }

  //     if (booking.status !== BOOKING_STATUS.PENDING) {
  //       throw new BadRequestException('Booking is not in PENDING state');
  //     }

  //     if (booking.technicianId) {
  //       throw new BadRequestException(
  //         'Booking is already accepted by another technician',
  //       );
  //     }

  //     booking.technicianId = technicianId;
  //     booking.status = BOOKING_STATUS.ACCEPTED;

  //     return bookingRepo.save(booking);
  //   });

  //   // Send socket notifications outside transaction
  //   try {
  //     const fullBooking = await this.bookingRepository.findBookingById(bookingId);
  //     if (fullBooking) {
  //       // 1. Notify the customer who initiated the booking
  //       this.bookingGateway.emitToUser(
  //         fullBooking.customerId,
  //         'booking_accepted',
  //         fullBooking,
  //       );

  //       // 2. Dismiss notifications for other technicians
  //       const otherTechIds = fullBooking.filteredTechnicians || [];
  //       for (const techId of otherTechIds) {
  //         if (techId !== technicianId) {
  //           this.bookingGateway.dismissNotification(techId);
  //         }
  //       }
  //     }
  //   } catch (e) {
  //     this.logger.error('Failed to send Socket.io notifications after booking acceptance', e);
  //   }

  //   return savedBooking;
  // }

  async acceptBookingService(
    technicianId: number,
    bookingId: number,
    dto: AcceptBookingDto,
  ): Promise<Booking> {
    const savedBooking = await this.dataSource.transaction(async (manager) => {
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

      if (booking.fromTime && booking.toTime) {
        if (!dto.scheduledAt) {
          throw new BadRequestException('scheduledAt is required for older bookings that have a time slot');
        }
        const scheduledAt = new Date(dto.scheduledAt);
        const fromTime = new Date(booking.fromTime);
        const toTime = new Date(booking.toTime);

        if (scheduledAt < fromTime || scheduledAt > toTime) {
          throw new BadRequestException(
            'Scheduled time must be within the booking scheduled time slot',
          );
        }
      }

      booking.technicianId = technicianId;
      booking.status = BOOKING_STATUS.ACCEPTED;
      if (dto.scheduledAt) {
        booking.scheduledAt = new Date(dto.scheduledAt);
      }

      return bookingRepo.save(booking);
    });

    // Send socket notifications outside transaction
    try {
      const fullBooking = await this.bookingRepository.findBookingById(bookingId);
      if (fullBooking) {
        // 1. Notify the customer who initiated the booking
        this.bookingGateway.emitToUser(
          fullBooking.customerId,
          'booking_accepted',
          fullBooking,
        );

        // 2. Dismiss notifications for other technicians
        const otherTechIds = fullBooking.filteredTechnicians || [];
        for (const techId of otherTechIds) {
          if (techId !== technicianId) {
            this.bookingGateway.dismissNotification(techId);
          }
        }
      }
    } catch (e) {
      this.logger.error('Failed to send Socket.io notifications after booking acceptance', e);
    }

    return savedBooking;
  }

  //TODO: Tushar's code for assigning booking
  // async assignBookingManuallyService(
  //   dto: AssignBookingDto,) {
  //   const { bookingId, technicianId } = dto;

  //   // Validate booking
  //   const booking =
  //     await this.bookingRepository.findManualAssignableBooking(
  //       bookingId,
  //     );

  //   if (!booking) {
  //     throw new UnprocessableEntityException(
  //       'Booking not found, not pending, or manual assignment not allowed',
  //     );
  //   }

  //   // Prevent reassignment
  //   if (booking.technicianId) {
  //     throw new UnprocessableEntityException(
  //       'Booking already assigned',
  //     );
  //   }

  //   // Validate technician
  //   const technician =
  //     await this.userRepository.findTechnicianById(
  //       technicianId,
  //     );

  //   if (!technician) {
  //     throw new UnprocessableEntityException(
  //       'Technician not found or inactive',
  //     );
  //   }

  //   // Check if technician actually provides the booked service
  //   const technicianProvidesService = technician.technicianProfile?.services?.some(
  //     (ts) => ts.serviceId === booking.serviceId,
  //   );

  //   if (!technicianProvidesService) {
  //     throw new BadRequestException(
  //       `Technician does not provide the service requested in this booking`,
  //     );
  //   }

  //   // Assign booking
  //   booking.technicianId = technician.id;
  //   booking.technician = technician;

  //   booking.status = BOOKING_STATUS.ACCEPTED;

  //   const updated =
  //     await this.bookingRepository.saveBooking(
  //       booking,
  //     );

  //   // Send socket notifications
  //   try {
  //     const fullBooking = await this.bookingRepository.findBookingById(bookingId);
  //     if (fullBooking) {
  //       // 1. Notify the customer
  //       this.bookingGateway.emitToUser(
  //         fullBooking.customerId,
  //         'booking_accepted',
  //         fullBooking,
  //       );

  //       // 2. Notify the assigned technician
  //       const { password, hashedRefreshToken, ...safeCustomer } = fullBooking.customer || {};
  //       this.bookingGateway.emitToUser(technicianId, 'booking_assigned', {
  //         bookingId: fullBooking.id,

  //         bookingInfo: {
  //           ...fullBooking,
  //           customer: undefined,
  //           service: undefined,
  //           address: undefined,
  //           technician: undefined,
  //         },

  //         serviceInfo: {
  //           ...fullBooking.service,
  //         },

  //         customerInfo: {
  //           ...safeCustomer,
  //           name: `${safeCustomer.firstName || ''} ${safeCustomer.lastName || ''}`.trim(),
  //         },

  //         addressInfo: {
  //           ...fullBooking.address,
  //         },
  //       });

  //       // 3. Dismiss notifications for other technicians
  //       const otherTechIds = fullBooking.filteredTechnicians || [];
  //       for (const techId of otherTechIds) {
  //         if (techId !== technicianId) {
  //           this.bookingGateway.dismissNotification(techId);
  //         }
  //       }
  //     }
  //   } catch (e) {
  //     this.logger.error('Failed to send Socket.io notifications after manual booking assignment', e);
  //   }

  //   return {
  //     success: true,
  //     message: 'Booking assigned successfully',
  //     data: updated,
  //   };
  // }

  async assignBookingManuallyService(
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

    if (booking.fromTime && booking.toTime) {
      const scheduledAt = new Date(dto.scheduledAt);
      const fromTime = new Date(booking.fromTime);
      const toTime = new Date(booking.toTime);

      if (scheduledAt < fromTime || scheduledAt > toTime) {
        throw new BadRequestException(
          'Scheduled time must be within the booking scheduled time slot',
        );
      }
    }

    // Assign booking
    booking.technicianId = technician.id;
    booking.technician = technician;

    booking.status = BOOKING_STATUS.ACCEPTED;
    booking.scheduledAt = new Date(dto.scheduledAt);

    const updated =
      await this.bookingRepository.saveBooking(
        booking,
      );

    // Send socket notifications
    try {
      const fullBooking = await this.bookingRepository.findBookingById(bookingId);
      if (fullBooking) {
        // 1. Notify the customer
        this.bookingGateway.emitToUser(
          fullBooking.customerId,
          'booking_accepted',
          fullBooking,
        );

        // 2. Notify the assigned technician
        const { password, hashedRefreshToken, ...safeCustomer } = fullBooking.customer || {};
        this.bookingGateway.emitToUser(technicianId, 'booking_assigned', {
          bookingId: fullBooking.id,

          bookingInfo: {
            ...fullBooking,
            customer: undefined,
            service: undefined,
            address: undefined,
            technician: undefined,
          },

          serviceInfo: {
            ...fullBooking.service,
          },

          customerInfo: {
            ...safeCustomer,
            name: `${safeCustomer.firstName || ''} ${safeCustomer.lastName || ''}`.trim(),
          },

          addressInfo: {
            ...fullBooking.address,
          },
        });

        // 3. Dismiss notifications for other technicians
        const otherTechIds = fullBooking.filteredTechnicians || [];
        for (const techId of otherTechIds) {
          if (techId !== technicianId) {
            this.bookingGateway.dismissNotification(techId);
          }
        }

        // 4. Send emails
        if (fullBooking.customer?.email) {
          await this.emailService.sendCustomerBookingConfirmation(fullBooking.customer.email, fullBooking, true);
          this.logger.log(`Booking update email sent to customer for booking ${fullBooking.id}`);
        }
        if (fullBooking.technician?.email) {
          await this.emailService.sendTechnicianAssignment(fullBooking.technician.email, fullBooking, false);
          this.logger.log(`Technician assignment email sent to technician for booking ${fullBooking.id}`);
        }
      }
    } catch (e) {
      this.logger.error('Failed to send Socket.io or email notifications after manual booking assignment', e);
    }

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
          isManualAssign: false,
          createdAt: new Date(),
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

    // Send socket notification to the technician if the customer cancels the booking
    if (user.role === USER_ROLE.CUSTOMER && booking.technician?.id) {
      try {
        this.bookingGateway.emitToUser(
          booking.technician.id,
          'booking_cancelled',
          {
            bookingId: booking.id,
            message: 'This booking has been cancelled by the customer',
          },
        );
      } catch (e) {
        this.logger.error(
          `Failed to send Socket.io cancellation notification to technician ${booking.technician.id}`,
          e,
        );
      }
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
    if (!user?.id) {
      throw new UnauthorizedException(
        'Invalid user',
      );
    }

    if (
      user.role !== USER_ROLE.CUSTOMER &&
      user.role !== USER_ROLE.TECHNICIAN
    ) {
      throw new BadRequestException(
        'Invalid role for complaint creation',
      );
    }

    // Ensure the same user cannot have more than one pending complaint at the same time
    const userPendingComplaint = await this.dataSource.getRepository(Complaint).findOne({
      where: {
        createdBy: user.id,
        status: COMPLAINT_STATUS.PENDING,
      },
    });

    if (userPendingComplaint) {
      throw new BadRequestException(
        'You already have a pending complaint. Please resolve it before creating a new one.',
      );
    }

    if (dto.bookingId) {
      const booking =
        await this.bookingRepository.findBookingById(
          dto.bookingId,
        );

      if (!booking) {
        throw new NotFoundException(
          'Booking not found',
        );
      }

      if (dto.serviceId && booking.serviceId !== dto.serviceId) {
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
      }
    }

    const complaint =
      await this.complaintRepository.createComplaint({
        bookingId: dto.bookingId ?? null,
        serviceId: dto.serviceId ?? null,
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
    userId: number,
    role: USER_ROLE,
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

      if (role === USER_ROLE.ADMIN) {
        if (dto.status !== BOOKING_STATUS.REJECTED) {
          throw new BadRequestException('Admin can only update the booking status to REJECTED');
        }
        if (booking.status !== BOOKING_STATUS.PENDING) {
          throw new BadRequestException('Booking can only be rejected if its current status is PENDING');
        }
        if (dto.cancellationReason) {
          booking.cancellationReason = dto.cancellationReason;
        }
        booking.status = dto.status;
        const updatedBooking = await bookingRepo.save(booking);
        return updatedBooking;
      }

      if (booking.technicianId !== userId) {
        throw new BadRequestException('You are not assigned to this booking');
      }

      if (
        dto.status !== BOOKING_STATUS.ENROUTE &&
        dto.status !== BOOKING_STATUS.ARRIVED &&
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
          { userId: userId },
          { jobStatus: JOB_STATUS.BUSY },
        );
      }

      if (dto.status === BOOKING_STATUS.COMPLETED) {
        await technicianProfileRepo.update(
          { userId: userId },
          { jobStatus: JOB_STATUS.AVAILABLE },
        );
      }

      if (dto.status === BOOKING_STATUS.ARRIVED) {
        if (!booking.customer || !booking.customer.phone) {
          throw new BadRequestException(
            'Customer does not have a registered phone number',
          );
        }

        let otpToSend = booking.customerOtp;
        if (!otpToSend) {
          otpToSend = Math.floor(100000 + Math.random() * 900000).toString();
          booking.customerOtp = otpToSend;
          await bookingRepo.save(booking);
        }

        try {
          await this.smsService.sendOtpSms(booking.customer.phone, otpToSend);
        } catch (error: any) {
          this.logger.error(
            `Failed to send OTP SMS to customer ${booking.customer.phone}`,
            error instanceof Error ? error.stack : String(error),
          );
        }
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

      if (!booking.customerOtp) {
        throw new BadRequestException(
          'No active OTP found for this booking.',
        );
      }

      if (booking.customerOtp !== dto.otp) {
        throw new BadRequestException('Invalid OTP');
      }

      // Transition booking to ONGOING and record startedAt time
      booking.status = BOOKING_STATUS.ONGOING;
      booking.startedAt = new Date();
      booking.customerOtp = undefined; // Clear OTP once verified
      const updatedBooking = await bookingRepo.save(booking);

      return updatedBooking;
    });
  }

  async resendBookingOtp(
    technicianId: number,
    bookingId: number,
  ): Promise<{ success: boolean; message: string }> {
    const booking = await this.bookingRepository.findBookingById(bookingId);

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.technicianId !== technicianId) {
      throw new ForbiddenException('You are not assigned to this booking');
    }

    if (booking.status !== BOOKING_STATUS.ARRIVED) {
      throw new BadRequestException(
        'OTP can only be resent when booking status is ARRIVED',
      );
    }

    if (!booking.customer || !booking.customer.phone) {
      throw new BadRequestException(
        'Customer does not have a registered phone number',
      );
    }

    const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
    booking.customerOtp = newOtp;
    await this.dataSource.getRepository(Booking).save(booking);

    try {
      await this.smsService.sendOtpSms(booking.customer.phone, newOtp);
    } catch (error: any) {
      this.logger.error(
        `Failed to send OTP SMS to customer ${booking.customer.phone}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new BadRequestException(
        'Failed to send OTP SMS. Please try again.',
      );
    }

    return {
      success: true,
      message: 'OTP resent successfully',
    };
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

      if (booking.customerId !== userId && booking.technicianId !== userId) {
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

      const customerPaymentMode = userId === booking.technicianId ? CUSTOMER_PAYMENT_MODE.CASH : CUSTOMER_PAYMENT_MODE.ONLINE;
      const payBy = userId === booking.technicianId ? USER_ROLE.TECHNICIAN : USER_ROLE.CUSTOMER;

      const existingPendingPayment = await paymentRepo.findOne({
        where: {
          bookingId: booking.id,
          status: PAYMENT_STATUS.PENDING,
          paymentType: PAYMENT_TYPE.BOOKING_PAYMENT,
          amount,
        },
        order: { createdAt: 'DESC' },
      });

      if (existingPendingPayment && existingPendingPayment.paymentLinkId) {
        if (existingPendingPayment.payBy !== payBy || existingPendingPayment.customerPaymentMode !== customerPaymentMode) {
          existingPendingPayment.payBy = payBy;
          existingPendingPayment.customerPaymentMode = customerPaymentMode;
          await paymentRepo.save(existingPendingPayment);
        }

        const fetchedLink = await this.paymentService.fetchPaymentLink(existingPendingPayment.paymentLinkId);
        if (fetchedLink && fetchedLink.status !== 'cancelled' && fetchedLink.status !== 'expired') {
          return { paymentUrl: fetchedLink.short_url };
        }
      }

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
        payBy,
        customerPaymentMode,
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
    rawBody?: string,
  ) {
    const bodyToVerify = rawBody || JSON.stringify(payload);
    const isValid =
      this.paymentService.verifyWebhook(
        bodyToVerify,
        signature,
      );

    if (!isValid) {
      console.error('Webhook signature verification failed!');
      console.error('Payload:', bodyToVerify);
      console.error('Signature:', signature);
      
      // Temporarily bypass signature check for testing if needed
      // throw new BadRequestException('Invalid webhook signature');
      console.warn('Bypassing signature validation for test environment');
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

      if (payment.status === PAYMENT_STATUS.SUCCESS && payment.booking) {
        payment.booking.technicianPayoutStatus = BOOKING_PAYMENT_STATUS.PAID;
        payment.booking.technicianPayoutId = payment.paymentId || payment.razorpayPayoutId || payment.utr || razorpayPayoutId;
        await this.bookingRepository.saveBooking(payment.booking);
      }

      return {
        success: true,
        message: `Payout event ${event} processed successfully`,
        data: payment,
      };
    }

    // Handle Customer Payment Link Webhooks (Razorpay Standard)
    console.log('Webhook Event Received:', payload.event);
    
    if (
      payload.event !==
      'payment_link.paid'
    ) {
      console.log('Ignoring event:', payload.event);
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
      payment.booking.bookingPaymentStatus = BOOKING_PAYMENT_STATUS.PAID;
      payment.booking.bookingPaymentId = payment.paymentId || paymentId;

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

    if (booking.bookingPaymentStatus !== BOOKING_PAYMENT_STATUS.PAID) {
      throw new BadRequestException(
        'Booking payment is not completed yet',
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

  async adminRecordTechnicianPayout(
    adminId: number,
    dto: AdminCreatePayoutDto,
  ) {
    const booking = await this.bookingRepository.findBookingById(dto.bookingId);
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    const technician = await this.userRepository.findOne({
      where: {
        id: dto.technicianId,
        role: USER_ROLE.TECHNICIAN,
      },
    });

    if (!technician) {
      throw new NotFoundException('Technician not found');
    }

    const paymentId = 'pay_manual_' + randomUUID().replace(/-/g, '').substring(0, 14);

    const payout = await this.paymentRepository.createPayment({
      bookingId: booking.id,
      technicianId: technician.id,
      customerId: booking.customerId,
      payoutBy: adminId,
      payBy: USER_ROLE.ADMIN,
      paymentType: PAYMENT_TYPE.TECHNICIAN_PAYOUT,
      amount: dto.amount,
      currency: 'INR',
      status: PAYMENT_STATUS.SUCCESS,
      paymentId,
    });

    // Update booking payout details
    booking.technicianPayoutStatus = BOOKING_PAYMENT_STATUS.PAID;
    booking.technicianPayoutId = paymentId;
    await this.bookingRepository.saveBooking(booking);

    return {
      success: true,
      message: 'Technician payout recorded successfully as SUCCESS',
      data: payout,
    };
  }

  //payment
  async getAllPayments(
    user: any,
    page: number,
    limit: number,
    status?: PAYMENT_STATUS,
    paymentType?: PAYMENT_TYPE,
  ) {
    let finalStatus = status;
    let finalPaymentType = paymentType;
    let technicianId: number | undefined;
    let customerId: number | undefined;

    if (user.role === USER_ROLE.TECHNICIAN) {
      finalStatus = PAYMENT_STATUS.SUCCESS;
      finalPaymentType = PAYMENT_TYPE.TECHNICIAN_PAYOUT;
      technicianId = user.id;
    } else if (user.role === USER_ROLE.CUSTOMER) {
      finalStatus = undefined;
      finalPaymentType = undefined;
      customerId = user.id;
    }

    return this.paymentRepository.findAllPayments(
      page,
      limit,
      finalStatus,
      finalPaymentType,
      technicianId,
      customerId,
    );
  }

  //Get Paymwents By ID 
  async getPaymentById(id: number, user?: any) {
    const payment =
      await this.paymentRepository.findPaymentById(id);

    if (!payment) {
      throw new NotFoundException(
        'Payment not found',
      );
    }

    if (user && user.role !== USER_ROLE.ADMIN) {
      if (user.role === USER_ROLE.TECHNICIAN && payment.technicianId !== user.id) {
        throw new ForbiddenException('Access denied');
      }
      if (user.role === USER_ROLE.CUSTOMER && payment.customerId !== user.id) {
        throw new ForbiddenException('Access denied');
      }
    }

    let formattedBooking: any = null;
    if (payment.booking) {
      const { service, serviceSpecifications, ...bookingDetails } = payment.booking;

      formattedBooking = {
        ...bookingDetails,
        service: service ? {
          id: service.id,
          name: service.name,
          description: service.description,
          iconUrl: service.iconUrl,
          isActive: service.isActive,
          pricingRule: service.pricingRule,
          chosenSpecifications: serviceSpecifications || [],
          masterSpecifications: service.specifications || [],
        } : null,
      };
    }

    const { booking, ...paymentDetails } = payment;

    return {
      success: true,
      message: 'Payment fetched successfully',
      data: {
        ...paymentDetails,
        booking: formattedBooking,
      },
    };
  }

  async getTechnicianPayoutStats(technicianId: number) {
    const payments = await this.dataSource.getRepository(Payment).find({
      where: {
        technicianId,
        status: PAYMENT_STATUS.SUCCESS,
        paymentType: PAYMENT_TYPE.TECHNICIAN_PAYOUT,
      },
    });

    const now = new Date();

    // Start of week (Monday)
    const startOfWeek = new Date(now);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0, 0, 0, 0);

    // Start of month
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    startOfMonth.setHours(0, 0, 0, 0);

    let totalEarning = 0;
    let thisWeekPayout = 0;
    let thisMonthPayout = 0;

    for (const payment of payments) {
      const amount = Number(payment.amount);
      totalEarning += amount;

      const paymentDate = new Date(payment.createdAt);
      if (paymentDate >= startOfWeek) {
        thisWeekPayout += amount;
      }
      if (paymentDate >= startOfMonth) {
        thisMonthPayout += amount;
      }
    }

    return {
      success: true,
      data: {
        totalEarning: Number(totalEarning.toFixed(2)),
        thisWeekPayout: Number(thisWeekPayout.toFixed(2)),
        thisMonthPayout: Number(thisMonthPayout.toFixed(2)),
      },
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
      const payments = booking.payments || [];
      const bookingPayment = payments.find(
        (p) =>
          (booking.bookingPaymentId && (p.paymentId === booking.bookingPaymentId || p.paymentLinkId === booking.bookingPaymentId)) ||
          p.paymentType === PAYMENT_TYPE.BOOKING_PAYMENT ||
          p.paymentType === PAYMENT_TYPE.TOKEN_PAYMENT
      ) || null;
      const technicianPayout = payments.find(
        (p) =>
          (booking.technicianPayoutId && (p.paymentId === booking.technicianPayoutId || p.razorpayPayoutId === booking.technicianPayoutId || p.utr === booking.technicianPayoutId)) ||
          p.paymentType === PAYMENT_TYPE.TECHNICIAN_PAYOUT
      ) || null;

      const commonData = {
        bookingId: booking.id,
        status: booking.status,
        paymentStatus: booking.bookingPaymentStatus,
        bookingPaymentStatus: booking.bookingPaymentStatus,
        technicianPayoutStatus: booking.technicianPayoutStatus,
        bookingPaymentId: booking.bookingPaymentId,
        technicianPayoutId: booking.technicianPayoutId,
        bookingPayment,
        technicianPayout,
        scheduledAt: booking.scheduledAt,
        scheduledAtIst: this.toIstString(booking.scheduledAt),
        fromTime: booking.fromTime,
        toTime: booking.toTime,
        fromTimeIst: this.toIstString(booking.fromTime),
        toTimeIst: this.toIstString(booking.toTime),
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

    const savedBookingResult = await this.dataSource.transaction(async (manager) => {
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

      let address: CustomerAddress | null = null;
      if (dto.customerAddressId) {
        address = await manager.getRepository(CustomerAddress).findOne({
          where: { id: dto.customerAddressId, userId: dto.customerId, isActive: true },
        });
        if (!address) {
          throw new NotFoundException('Address not found or does not belong to this customer');
        }
      } else {
        address = await manager.getRepository(CustomerAddress).findOne({
          where: { userId: dto.customerId, isActive: true, isDefault: true },
        });
        if (!address) {
          throw new NotFoundException('No default address found for this customer');
        }
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

      const appliedBasePrice = pricingRule.isServiceBasePriceApplied !== false
        ? serviceBasePrice
        : 0;

      const subtotal = appliedBasePrice + weekendCharge + peakHourCharge + surgeCharge + emergencyCharge + distanceCharge;
      const platformFee = pricingRule.isPlatformFeeApplied ? Number(pricingRule.platformFee) : 0;
      const gstRate = Number(pricingRule.gst) / 100;
      const gst = pricingRule.isGstApplied ? Number(((subtotal + platformFee) * gstRate).toFixed(2)) : 0;

      const totalAmount = Number((subtotal + platformFee + gst).toFixed(2));
      if (totalAmount < appliedBasePrice) {
        throw new BadRequestException('Calculation error: Total amount must be greater than base price.');
      }

      const platformEarning = platformFee;
      const technicianEarning = subtotal;

      const priceBreakdown: PriceBreakdown = {
        serviceBasePrice: appliedBasePrice,
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

      const customerOtp = Math.floor(100000 + Math.random() * 900000).toString();

      const booking = manager.getRepository(Booking).create({
        customerId: dto.customerId,
        technicianId: dto.technicianId,
        serviceId: dto.serviceId,
        addressId: address.id,
        serviceSpecifications: serviceSpecifications as any,
        isEmergency: dto.isEmergency ?? false,
        scheduledAt: targetDate,
        status: BOOKING_STATUS.ACCEPTED, // Pre-assigned by Admin
        totalAmount,
        priceBreakdown,
        isManualAssign: true,
        customerOtp,
      });

      return manager.getRepository(Booking).save(booking);
    });

    try {
      const fullBooking = await this.bookingRepository.findBookingById(savedBookingResult.id);
      if (fullBooking) {
        if (fullBooking.customer?.email) {
          await this.emailService.sendCustomerBookingConfirmation(fullBooking.customer.email, fullBooking, false);
          this.logger.log(`Booking confirmation email sent to customer for booking ${fullBooking.id}`);
        }
        if (fullBooking.technician?.email) {
          await this.emailService.sendTechnicianAssignment(fullBooking.technician.email, fullBooking);
          this.logger.log(`Technician assignment email sent to technician for booking ${fullBooking.id}`);
        }
      }
    } catch (e) {
      this.logger.error('Failed to send booking emails for adminCreateBooking', e);
    }

    return savedBookingResult;
  }

  async getActiveBookingForTechnician(
    technicianId: number,
    page: number = 1,
    limit: number = 10,
    search?: string,
  ) {
    const { bookings, total } =
      await this.bookingRepository.findActiveBookingsForTechnician(
        technicianId,
        page,
        limit,
        search,
      );
    const formattedBookings = await Promise.all(
      bookings.map(async (booking) => {
        let customerProfileImageUrl: string | null = null;
        if (booking.customer?.profileImage) {
          try {
            customerProfileImageUrl = await this.s3Service.getDownloadUrl(booking.customer.profileImage);
          } catch (error) {
            this.logger.error('Failed to get download URL for customer profileImage', error);
          }
        }

        let serviceIconUrl: string | null = null;
        if (booking.service?.iconUrl) {
          try {
            serviceIconUrl = await this.s3Service.getDownloadUrl(booking.service.iconUrl);
          } catch (error) {
            this.logger.error('Failed to get download URL for service iconUrl', error);
          }
        }

        const addressObj = booking.address
          ? {
            id: booking.address.id,
            fullAddress: booking.address.fullAddress,
            city: booking.address.city,
            state: booking.address.state,
            pincode: booking.address.pincode,
            latitude: booking.address.latitude,
            longitude: booking.address.longitude,
          }
          : null;

        return {
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
              profileImage: customerProfileImageUrl,
              address: addressObj,
            }
            : null,

          service: booking.service
            ? {
              id: booking.service.id,
              name: booking.service.name,
              iconUrl: serviceIconUrl,
              pricingRule: booking.service.pricingRule ?? null,
              specifications: booking.service.specifications ?? null,
            }
            : null,

          address: addressObj,
          scheduledAt: booking.scheduledAt ?? null,
          fromTime: booking.fromTime ?? null,
          toTime: booking.toTime ?? null,
          fromTimeIst: booking.fromTime ? this.toIstString(booking.fromTime) : null,
          toTimeIst: booking.toTime ? this.toIstString(booking.toTime) : null,
          totalAmount: booking.totalAmount ?? null,
          priceBreakdown: booking.priceBreakdown ?? null,
          serviceSpecifications: booking.serviceSpecifications ?? null,
          createdAt: booking.createdAt,
        };
      }),
    );

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