import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Payment, PAYMENT_STATUS, PAYMENT_TYPE } from '@hichandra/entities';
import { Repository, Not, IsNull } from 'typeorm';

@Injectable()
export class PaymentRepository {
  constructor(
    @InjectRepository(Payment)
    private readonly repo: Repository<Payment>,
  ) { }

  async findAllPayments(
    page: number,
    limit: number,
    status?: PAYMENT_STATUS,
    paymentType?: PAYMENT_TYPE,
    technicianId?: number,
    customerId?: number,
  ) {
    const query = this.repo
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.customer', 'customer')
      .leftJoinAndSelect('payment.technician', 'technician')
      .leftJoinAndSelect('payment.payoutByUser', 'payoutByUser');

    if (status) {
      query.andWhere(
        'payment.status = :status',
        { status },
      );
    }

    if (paymentType) {
      query.andWhere(
        'payment.paymentType = :paymentType',
        { paymentType },
      );
    }

    if (technicianId) {
      query.andWhere(
        'payment.technicianId = :technicianId',
        { technicianId },
      );
    }

    if (customerId) {
      query.andWhere(
        'payment.customerId = :customerId',
        { customerId },
      );
    }

    query.orderBy(
      'payment.createdAt',
      'DESC',
    );

    const [payments, total] =
      await query
        .skip((page - 1) * limit)
        .take(limit)
        .getManyAndCount();

    return {
      payments,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
  async findByPaymentLinkId(
    paymentLinkId: string,
  ) {
    return this.repo.findOne({
      where: { paymentLinkId },
      relations: {
        booking: true,
        customer: true,
        technician: true,
      },
    });
  }

  async findByRazorpayPayoutId(
    razorpayPayoutId: string,
  ) {
    return this.repo.findOne({
      where: { razorpayPayoutId },
      relations: {
        booking: true,
        customer: true,
        technician: true,
        payoutByUser: true,
      },
    });
  }

  async findExistingPayout(
    bookingId: number,
    technicianId: number,
  ) {
    return this.repo.findOne({
      where: {
        bookingId,
        technicianId,
        payoutBy: Not(IsNull()),
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async updatePayment(
    payment: Payment,
  ) {
    return this.repo.save(payment);
  }

  async createPayment(
    data: Partial<Payment>,
  ) {
    const payment = this.repo.create(data);
    return this.repo.save(payment);
  }
  async findPaymentById(id: number) {
    return this.repo
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.customer', 'customer')
      .leftJoinAndSelect('payment.technician', 'technician')
      .leftJoinAndSelect('payment.payoutByUser', 'payoutByUser')
      .leftJoinAndSelect('payment.booking', 'booking')
      .leftJoinAndSelect('booking.service', 'service')
      .leftJoinAndSelect('service.pricingRule', 'pricingRule')
      .leftJoinAndSelect('service.specifications', 'specifications')
      .leftJoinAndSelect('booking.address', 'address')
      .where('payment.id = :id', { id })
      .getOne();
  }

  async findLatestByBookingId(
    bookingId: number,
  ): Promise<Payment | null> {
    return this.repo.findOne({
      where: { bookingId },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async getTodayRevenue(): Promise<number> {
    const result = await this.repo
      .createQueryBuilder('payment')
      .select(
        'COALESCE(SUM(payment.amount), 0)',
        'totalRevenue',
      )
      .where('payment.status = :status', {
        status: PAYMENT_STATUS.SUCCESS,
      })
      .andWhere(`
        DATE(
          payment."createdAt"
          AT TIME ZONE 'UTC'
          AT TIME ZONE 'Asia/Kolkata'
        ) =
        DATE(
          NOW()
          AT TIME ZONE 'Asia/Kolkata'
        )
      `)
      .getRawOne<{
        totalRevenue: string;
      }>();

    return Number(result?.totalRevenue ?? 0);
  }
}