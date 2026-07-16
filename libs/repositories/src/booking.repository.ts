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
        service: {
          pricingRule: true,
          specifications: true,
        },
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

  async updateBookingCancelFields(
    bookingId: number,
    data: Partial<Booking>,
  ) {
    await this.repo.update(bookingId, data);

    return this.findBookingById(bookingId);
  }

  // async findActiveBookingForTechnician(
  //   technicianId: number,
  // ): Promise<Booking | null> {
  //   return this.repo.findOne({
  //     where: {
  //       status: BOOKING_STATUS.PENDING,
  //       isManualAssign: false,
  //       filteredTechnicians: technicianId,
  //     },
  //     relations: {
  //       customer: true,
  //       service: true,
  //       address: true,
  //     },
  //     order: {
  //       createdAt: 'DESC',
  //     },
  //   });
  // }

  async markExpiredAsManual(): Promise<number> {
    const fiveMinutesAgo = new Date(
      Date.now() - 5 * 60 * 1000,
    );

    const result = await this.repo.createQueryBuilder().update(Booking).set({
        isManualAssign: true,
      })
      .where('status = :status', {
        status: BOOKING_STATUS.PENDING,
      })
      .andWhere('"technicianId" IS NULL')
      .andWhere('"isManualAssign" = :isManualAssign', {
        isManualAssign: false,
      })
      .andWhere('"createdAt" <= :fiveMinutesAgo', {
        fiveMinutesAgo,
      })
      .execute();

    return result.affected ?? 0;
  }

  async countAllBookings(): Promise<number> {
    return this.repo.count();
  }

  async countAvailableJobsForTechnician(
    technicianId: number,
  ): Promise<number> {
    return this.repo.createQueryBuilder('booking')
      .where('booking.status = :status', {status: BOOKING_STATUS.PENDING,})
      .andWhere('booking."technicianId" IS NULL')
      .andWhere('booking."isManualAssign" = false')
      .andWhere('booking."filteredTechnicians" @> :technicianFilter',
        {
          technicianFilter: JSON.stringify([technicianId,]),
        },
      )
      .getCount();
  }

  async getTechnicianDashboardBookingStats(technicianId: number,
  ): Promise<{
    availableJobs: number;
    activeJobs: number;
    todayEarning: number;
    totalEarning: number;
  }> {
    const activeStatuses = [
      BOOKING_STATUS.ACCEPTED,
      BOOKING_STATUS.ENROUTE,
      BOOKING_STATUS.ARRIVED,
      BOOKING_STATUS.ONGOING,
    ];

    const result = await this.repo
      .createQueryBuilder('booking')
      .select(
        `
        COUNT(*) FILTER (
          WHERE booking.status = :pendingStatus
            AND booking."technicianId" IS NULL
            AND booking."isManualAssign" = false
            AND booking."filteredTechnicians" IS NOT NULL
            AND booking."filteredTechnicians"
                @> CAST(:technicianFilter AS jsonb)
        )
        `,
        'availableJobs',
      )
      .addSelect(
        `
        COUNT(*) FILTER (
          WHERE booking."technicianId" = :technicianId
            AND booking.status IN (:...activeStatuses)
        )
        `,
        'activeJobs',
      )
      .addSelect(
        `
        COALESCE(
          SUM(
            CASE
              WHEN booking."technicianId" = :technicianId
                AND booking.status = :completedStatus
                AND (
                  booking."updatedAt"
                  AT TIME ZONE 'Asia/Kolkata'
                )::date =
                (
                  NOW()
                  AT TIME ZONE 'Asia/Kolkata'
                )::date
              THEN COALESCE(
                (
                  booking."priceBreakdown"
                  ->> 'technicianEarning'
                )::numeric,
                0
              )
              ELSE 0
            END
          ),
          0
        )
        `,
        'todayEarning',
      )
      .addSelect(
        `
        COALESCE(
          SUM(
            CASE
              WHEN booking."technicianId" = :technicianId
                AND booking.status = :completedStatus
              THEN COALESCE(
                (
                  booking."priceBreakdown"
                  ->> 'technicianEarning'
                )::numeric,
                0
              )
              ELSE 0
            END
          ),
          0
        )
        `,
        'totalEarning',
      )
      .setParameters({ technicianId,
        technicianFilter: JSON.stringify([technicianId]),
        pendingStatus: BOOKING_STATUS.PENDING,
        completedStatus: BOOKING_STATUS.COMPLETED,
        activeStatuses,
      })
      .getRawOne<{
        availableJobs: string;
        activeJobs: string;
        todayEarning: string;
        totalEarning: string;
      }>();

    return {
      availableJobs: Number(result?.availableJobs ?? 0,),
      activeJobs: Number(result?.activeJobs ?? 0,),
      todayEarning: Number(result?.todayEarning ?? 0,),
      totalEarning: Number(result?.totalEarning ?? 0,),
    };
  }
}
