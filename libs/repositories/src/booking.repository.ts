import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Booking, BOOKING_STATUS, BOOKING_PAYMENT_STATUS, USER_ROLE } from '@hichandra/entities';
import { Repository, Not, IsNull } from 'typeorm';

@Injectable()
export class BookingRepository {
  constructor(
    @InjectRepository(Booking)
    private readonly repo: Repository<Booking>,
  ) { }

  async findAllBookings(
    user: any,
    page = 1,
    limit = 10,
    status?: BOOKING_STATUS,
  ) {
    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (user.role === USER_ROLE.CUSTOMER) {
      where.customer = {
        id: user.id,
      };
    }

    if (user.role === USER_ROLE.TECHNICIAN) {
      where.technician = {
        id: user.id,
      };
    }

    const [bookings, total] = await this.repo.findAndCount({
      where,
      relations: {
        customer: true,
        technician: true,
        service: true,
        address: true,
      },
      skip: (page - 1) * limit,
      take: limit,
      order: {
        createdAt: 'DESC',
      },
    });

    return {
      bookings,
      total,
    };
  }

  async findBookingById(id: number) {
    return this.repo.findOne({
      where: { id },
      relations: {
        customer: true,
        technician: true,
        service: true,
        address: true,
      },
    });
  }

  async findManualAssignableBooking(
    bookingId: number,
  ) {
    return this.repo.findOne({
      where: {
        id: bookingId,
        isManualAssign: true,
        status: BOOKING_STATUS.PENDING,
      },
      relations: {
        customer: true,
        technician: true,
        service: true,
        address: true,
      },
    });
  }

  async saveBooking(booking: Booking) {
    return this.repo.save(booking);
  }

  async findCustomerBooking(
    bookingId: number,
    customerId: number,
  ) {
    return this.repo.findOne({
      where: {
        id: bookingId,
        customerId,
      },
    });
  }

  async createBooking(data: Partial<Booking>) {
    const booking = this.repo.create(data);
    return this.repo.save(booking);
  }

  async updateReviewFields(
  bookingId: number,
  data: Partial<Booking>,
  ) {
    await this.repo.update(
      { id: bookingId },
      data,
    );

    return this.findBookingById(bookingId);
  }

  async findTechnicianRatedBookings(
  technicianId: number,
  ) {
    return this.repo.find({
      where: {
        technicianId,
        status:
          BOOKING_STATUS.COMPLETED,
        paymentStatus:
          BOOKING_PAYMENT_STATUS.PAID,
      },
    });
  }

  async findCustomerRatedBookings(
  customerId: number,
  ) {
    return this.repo.find({
      where: {
        customerId,
        status: BOOKING_STATUS.COMPLETED,
        paymentStatus: BOOKING_PAYMENT_STATUS.PAID,
      },
    });
  }
  async findTechnicianReviews(
    technicianId: number,
    page = 1,
    limit = 10,
  ) {
    const [reviews, total] = await this.repo.findAndCount({
      where: {
        technicianId,
        status: BOOKING_STATUS.COMPLETED,
        paymentStatus: BOOKING_PAYMENT_STATUS.PAID,
        customerRating: Not(IsNull()),
      },
      relations: {
        customer: true,
        technician: true,
        service: true,
      },
      order: {
        updatedAt: 'DESC',
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      reviews,
      total,
    };
  }

  async findMyReviews(
    userId: number,
    role: USER_ROLE,
    page = 1,
    limit = 10,
  ) {
    const where: any = {
      status: BOOKING_STATUS.COMPLETED,
      paymentStatus: BOOKING_PAYMENT_STATUS.PAID,
    };

    if (role === USER_ROLE.CUSTOMER) {
      where.customerId = userId;
      where.technicianRating = Not(IsNull());
    }

    if (role === USER_ROLE.TECHNICIAN) {
      where.technicianId = userId;
      where.customerRating = Not(IsNull());
    }

    const [reviews, total] = await this.repo.findAndCount({
      where,
      relations: {
        customer: true,
        technician: true,
        service: true,
        address: true,
      },
      order: {
        updatedAt: 'DESC',
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      reviews,
      total,
    };
  }

  async findAllReviews(page = 1, limit = 10) {
    const [reviews, total] = await this.repo.findAndCount({
      where: [
        { customerRating: Not(IsNull()) },
        { technicianRating: Not(IsNull()) },
      ],
      relations: ['customer', 'technician', 'service'],
      order: {
        updatedAt: 'DESC',
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      reviews,
      total,
    };
  }

  async findMyBookings(
    userId: number,
    role: USER_ROLE,
    page = 1,
    limit = 10,
    status?: BOOKING_STATUS,
  ) {
    const where: any = {};

    if (role === USER_ROLE.CUSTOMER) {
      where.customerId = userId;
    }

    if (role === USER_ROLE.TECHNICIAN) {
      where.technicianId = userId;
    }

    if (status) {
      where.status = status;
    }

    const [bookings, total] = await this.repo.findAndCount({
      where,
      relations: {
        customer: true,
        technician: true,
        service: true,
        address: true,
      },
      order: {
        createdAt: 'DESC',
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      bookings,
      total,
    };
  }
}