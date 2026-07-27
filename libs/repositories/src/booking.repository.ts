import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Booking, BOOKING_STATUS, BOOKING_PAYMENT_STATUS, USER_ROLE, REVIEW_STATUS } from '@hichandra/entities';
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
    sortBy: 'id' | 'updatedAt' = 'updatedAt',
    sortOrder: 'ASC' | 'DESC' = 'DESC',
    reviewStatus?: REVIEW_STATUS,
  ) {
    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (reviewStatus) {
      where.reviewStatus = reviewStatus;
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
        customer: {
          addresses: true,
        },
        technician: {
          technicianProfile: {
            services: true,
            brandExpertise: true,
            locations: true,
          },
        },
        service: {
          pricingRule: true,
          specifications: true,
        },
        address: true,
      },
      skip: (page - 1) * limit,
      take: limit,
      order: {
        [sortBy]: sortOrder,
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

  async findPublicReviews(
    page = 1,
    limit = 10,
    reviewStatus?: REVIEW_STATUS,
    serviceId?: number,
  ) {
    const where: any = {};

    if (reviewStatus) {
      where.reviewStatus = reviewStatus;
    }

    if (serviceId) {
      where.serviceId = serviceId;
    }

    where.customerRating = Not(IsNull());

    const [reviews, total] = await this.repo.findAndCount({
      where,
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

  async findActiveBookingsForTechnician(
    technicianId: number,
    page: number = 1,
    limit: number = 10,
    search?: string,
  ): Promise<{ bookings: Booking[]; total: number }> {
    const skip = (page - 1) * limit;
    console.log(technicianId);

    const query = this.repo
      .createQueryBuilder('booking')
      .leftJoinAndSelect('booking.customer', 'customer')
      .leftJoinAndSelect('booking.service', 'service')
      .leftJoinAndSelect('booking.address', 'address')
      .where('booking.status = :status', { status: BOOKING_STATUS.PENDING })
      .andWhere('booking.isManualAssign = :isManualAssign', {
        isManualAssign: false,
      })
      .andWhere('booking.filteredTechnicians @> :technicianId', {
        technicianId: JSON.stringify([technicianId]),
      })
      .andWhere('booking.technicianId IS NULL');

    if (search) {
      query.andWhere('service.name ILIKE :search', { search: `%${search}%` });
    }

    const [bookings, total] = await query
      .orderBy('booking.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return { bookings, total };
  }

  async markExpiredAsManual(): Promise<number> {
    const bookings = await this.repo.find({
      where: {
        status: BOOKING_STATUS.PENDING,
        technicianId: IsNull(),
        isManualAssign: false,
      },
    });

    const now = Date.now();
    const expiredBookingIds: number[] = [];
    for (const booking of bookings) {
      if (booking.createdAt) {
        const d = booking.createdAt;
        const utcTime = Date.UTC(
          d.getFullYear(),
          d.getMonth(),
          d.getDate(),
          d.getHours(),
          d.getMinutes(),
          d.getSeconds(),
          d.getMilliseconds()
        );
        console.log(utcTime);
        const diffMs = now - utcTime;
        if (diffMs > 5 * 60 * 1000) {
          expiredBookingIds.push(booking.id);
        }
      }
    }

    if (expiredBookingIds.length > 0) {
      await this.repo.createQueryBuilder()
        .update(Booking)
        .set({ isManualAssign: true })
        .whereInIds(expiredBookingIds)
        .execute();
    }

    return expiredBookingIds.length;
  }

  async countAllBookings(): Promise<number> {
    return this.repo.count();
  }

  async countAvailableJobsForTechnician(
    technicianId: number,
  ): Promise<number> {
    return this.repo.createQueryBuilder('booking')
      .where('booking.status = :status', { status: BOOKING_STATUS.PENDING, })
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
      .setParameters({
        technicianId,
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
