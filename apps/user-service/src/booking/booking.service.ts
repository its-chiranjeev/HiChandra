import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Booking, BOOKING_STATUS, Service, CustomerAddress, User, USER_ROLE, USER_STATUS, TECHNICIAN_STATUS, TechnicianService, TechnicianLocation } from '@hichandra/entities';
import { CreateBookingDto } from '@hichandra/dtos';
import { AssignmentService } from '../assignment/assignment.service';

@Injectable()
export class BookingService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly assignmentService: AssignmentService,
  ) { }

  async createBooking(customerId: number, dto: CreateBookingDto): Promise<Booking> {
    return this.dataSource.transaction(async (manager) => {
      const serviceRepo = manager.getRepository(Service);
      const addressRepo = manager.getRepository(CustomerAddress);
      const bookingRepo = manager.getRepository(Booking);
      const technicianServices = await manager.getRepository(TechnicianService).find({
        where: { serviceId: dto.serviceId },
      });
      let allTechnicianWithService = await Promise.all(technicianServices.map(async ts => {
        const technicianProfileId = ts.technicianProfileId;
        const user = await manager.getRepository(User).findOne({
          where: { technicianProfileId: technicianProfileId },
          relations: ["technicianProfile", "technicianProfile.locations"]
        });
        if (user?.technicianProfile?.locations) {
          user.technicianProfile.locations = user.technicianProfile.locations.filter(loc => loc.isDefault);
        }
        return user;
      }));

      const service = await serviceRepo.findOne({
        where: { id: dto.serviceId, isActive: true },
        relations: ['specifications'],
      });
      if (!service) {
        throw new NotFoundException('Service not found or inactive');
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
        throw new BadRequestException('You already have a pending booking for this service');
      }

      // Check for same-day booking of the same service
      const targetDate = dto.scheduledAt ? new Date(dto.scheduledAt) : new Date();
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      const sameDayBooking = await bookingRepo.createQueryBuilder('booking')
        .where('booking.customerId = :customerId', { customerId })
        .andWhere('booking.serviceId = :serviceId', { serviceId: dto.serviceId })
        .andWhere('booking.scheduledAt BETWEEN :startOfDay AND :endOfDay', { startOfDay, endOfDay })
        .andWhere('booking.status != :cancelledStatus', { cancelledStatus: BOOKING_STATUS.CANCELLED })
        .getOne();

      if (sameDayBooking) {
        throw new BadRequestException(`You already have an active booking for this service on this date (Status: ${sameDayBooking.status})`);
      }

      const dbSpecs = service.specifications || [];
      const userSpecs = dto.serviceSpecifications || [];
      const dbSpecsMap = new Map(dbSpecs.map(s => [s.id, s]));

      // 1. Check if all required specs are present in userSpecs
      const requiredSpecs = dbSpecs.filter(s => s.isRequired && s.isActive);
      for (const reqSpec of requiredSpecs) {
        const found = userSpecs.find(u => u.specificationId === reqSpec.id);
        if (!found || found.value === undefined || found.value === null) {
          throw new BadRequestException(`Specification "${reqSpec.name}" (ID ${reqSpec.id}) is required`);
        }
      }

      // 2. Validate userSpecs and fill names automatically
      for (const uSpec of userSpecs) {
        const dbSpec = dbSpecsMap.get(uSpec.specificationId);
        if (!dbSpec || !dbSpec.isActive) {
          throw new BadRequestException(`Specification ID ${uSpec.specificationId} is not valid for this service`);
        }

        // Autofill name from DB if not provided
        uSpec.name = dbSpec.name;

        // Type checks
        if (dbSpec.type === 'number') {
          if (typeof uSpec.value !== 'number') {
            throw new BadRequestException(`Specification "${dbSpec.name}" must be a number`);
          }
        } else if (dbSpec.type === 'select') {
          if (typeof uSpec.value !== 'string') {
            throw new BadRequestException(`Specification "${dbSpec.name}" must be a string value`);
          }
          if (dbSpec.values && Array.isArray(dbSpec.values)) {
            const allowed = dbSpec.values as string[];
            if (!allowed.includes(uSpec.value)) {
              throw new BadRequestException(`Value "${uSpec.value}" is not valid for "${dbSpec.name}". Allowed values: ${allowed.join(', ')}`);
            }
          }
        } else if (dbSpec.type === 'multiselect') {
          if (!Array.isArray(uSpec.value)) {
            throw new BadRequestException(`Specification "${dbSpec.name}" must be an array of string values`);
          }
          if (dbSpec.values && Array.isArray(dbSpec.values)) {
            const allowed = dbSpec.values as string[];
            for (const val of uSpec.value) {
              if (typeof val !== 'string') {
                throw new BadRequestException(`Each value in "${dbSpec.name}" must be a string`);
              }
              if (!allowed.includes(val)) {
                throw new BadRequestException(`Value "${val}" is not valid for "${dbSpec.name}". Allowed values: ${allowed.join(', ')}`);
              }
            }
          }
        } else if (dbSpec.type === 'text') {
          if (typeof uSpec.value !== 'string') {
            throw new BadRequestException(`Specification "${dbSpec.name}" must be a string`);
          }
        } else if (dbSpec.type === 'image') {
          if (typeof uSpec.value !== 'string') {
            throw new BadRequestException(`Specification "${dbSpec.name}" must be an image URL string`);
          }
        }
      }

      const address = await addressRepo.findOne({ where: { id: dto.customerAddressId, userId: customerId, isActive: true, isDefault: true } });
      if (!address) {
        throw new NotFoundException('Address not found or does not belong to this customer');
      }
      const serviceSpecifications = userSpecs.map(uSpec => ({
        specificationId: uSpec.specificationId,
        value: uSpec.value,
      }));

      const booking = bookingRepo.create({
        customerId,
        serviceId: dto.serviceId,
        addressId: dto.customerAddressId,
        serviceSpecifications: serviceSpecifications as any,
        isEmergency: dto.isEmergency ?? false,
        scheduledAt: targetDate,
        status: BOOKING_STATUS.PENDING,
      });

      const savedBooking = await bookingRepo.save(booking);

      // Filter technician list based on availability and send notifications
      const activeTechnicians = allTechnicianWithService.filter((u): u is User => !!u);
      await this.assignmentService.assignTechnician(
        savedBooking,
        activeTechnicians,
        address,
        service,
      );
      throw new Error("hell");
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

  async acceptBooking(technicianId: number, bookingId: number): Promise<Booking> {
    return this.dataSource.transaction(async (manager) => {
      const bookingRepo = manager.getRepository(Booking);
      const userRepo = manager.getRepository(User);

      const technician = await userRepo.findOne({ where: { id: technicianId, role: USER_ROLE.TECHNICIAN }, relations: ['technicianProfile'] });
      if (!technician) {
        throw new NotFoundException('Technician not found or user is not a technician');
      }
      if (technician.status !== USER_STATUS.ACTIVE || technician.technicianProfile?.status !== TECHNICIAN_STATUS.APPROVED) {
        throw new BadRequestException('Technician is not active or not approved');
      }

      const booking = await bookingRepo.findOne({ where: { id: bookingId } });
      if (!booking) {
        throw new NotFoundException('Booking not found');
      }

      if (booking.status !== BOOKING_STATUS.PENDING) {
        throw new BadRequestException('Booking is not in PENDING state');
      }

      if (booking.technicianId) {
        throw new BadRequestException('Booking is already accepted by another technician');
      }

      booking.technicianId = technicianId;
      booking.status = BOOKING_STATUS.ACCEPTED;

      return bookingRepo.save(booking);
    });
  }
}

