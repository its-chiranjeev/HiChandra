import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Booking, BOOKING_STATUS, Service, CustomerAddress, User, USER_ROLE, USER_STATUS, TECHNICIAN_STATUS } from '@hichandra/entities';
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
      const allTechnicianWithService = await manager.getRepository(User)
        .createQueryBuilder('user')
        .innerJoinAndSelect('user.technicianProfile', 'profile')
        .innerJoinAndSelect('profile.services', 'service')
        .where('user.role = :role', { role: USER_ROLE.TECHNICIAN })
        .andWhere('user.status = :userStatus', { userStatus: USER_STATUS.ACTIVE })
        .andWhere('profile.status = :profileStatus', { profileStatus: TECHNICIAN_STATUS.APPROVED })
        .andWhere('service.id = :serviceId', { serviceId: dto.serviceId })
        .getMany();

      const service = await serviceRepo.findOne({
        where: { id: dto.serviceId, isActive: true },
        relations: ['specifications'],
      });
      if (!service) {
        throw new NotFoundException('Service not found or inactive');
      }

      const dbSpecs = service.specifications || [];
      const userSpecs = dto.serviceSpecifications || [];
      const dbSpecsMap = new Map(dbSpecs.map(s => [s.id, s]));

      // 1. Check if all required specs are present in userSpecs
      const requiredSpecs = dbSpecs.filter(s => s.isRequired && s.isActive);
      for (const reqSpec of requiredSpecs) {
        const found = userSpecs.find(u => u.specificationId === reqSpec.id || u.subSpecificationServiceId === reqSpec.id);
        if (!found || found.value === undefined || found.value === null) {
          throw new BadRequestException(`Specification "${reqSpec.name}" (ID ${reqSpec.id}) is required`);
        }
      }

      // 2. Validate userSpecs and fill names automatically
      for (const uSpec of userSpecs) {
        const specId = uSpec.specificationId || uSpec.subSpecificationServiceId;
        if (!specId) {
          throw new BadRequestException('Each service specification must have a specificationId or subSpecificationServiceId');
        }

        const dbSpec = dbSpecsMap.get(specId);
        if (!dbSpec || !dbSpec.isActive) {
          throw new BadRequestException(`Specification ID ${specId} is not valid for this service`);
        }

        // Normalize specification identifiers
        uSpec.specificationId = specId;
        uSpec.subSpecificationServiceId = specId;

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

      const address = await addressRepo.findOne({ where: { id: dto.customerAddressId, userId: customerId, isActive: true } });
      if (!address) {
        throw new NotFoundException('Address not found or does not belong to this customer');
      }

      const booking = bookingRepo.create({
        customerId,
        serviceId: dto.serviceId,
        addressId: dto.customerAddressId,
        serviceSpecifications: dto.serviceSpecifications as any,
        isEmergency: dto.isEmergency ?? false,
        scheduledAt: dto.scheduledAt,
        status: BOOKING_STATUS.PENDING,
      });

      const savedBooking = await bookingRepo.save(booking);

      await this.assignmentService.autoAssign(savedBooking);

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

