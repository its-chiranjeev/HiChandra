import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Payment, PAYMENT_STATUS } from '@hichandra/entities';
import { Repository } from 'typeorm';

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
  ) {
    const query = this.repo
      .createQueryBuilder('payment')
      .leftJoinAndSelect(
        'payment.customer',
        'customer',
      )
      .leftJoinAndSelect(
        'payment.booking',
        'booking',
      );

    if (status) {
      query.andWhere(
        'payment.status = :status',
        { status },
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
      },
    });
  }

  async updatePayment(
    payment: Payment,
  ) {
    return this.repo.save(payment);
  }

  async findPaymentById(id: number) {
  return this.repo.findOne({
    where: { id },
    relations: {
      booking: true,
      customer: true,
    },
  });
}
}