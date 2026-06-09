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

      const service = await serviceRepo.findOne({ where: { id: dto.serviceId, isActive: true } });
      if (!service) {
        throw new NotFoundException('Service not found or inactive');
      }

      const address = await addressRepo.findOne({ where: { id: dto.customerAddressId, userId: customerId, isActive: true } });
      if (!address) {
        throw new NotFoundException('Address not found or does not belong to this customer');
      }

      const booking = bookingRepo.create({
        customerId,
        serviceId: dto.serviceId,
        addressId: dto.customerAddressId,
        serviceSpecifications: dto.serviceSpecifications,
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

