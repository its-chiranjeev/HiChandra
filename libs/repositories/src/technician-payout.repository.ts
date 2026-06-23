import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TechnicianPayout } from '@hichandra/entities';
import { Repository } from 'typeorm';

@Injectable()
export class TechnicianPayoutRepository {
  constructor(
    @InjectRepository(TechnicianPayout)
    private readonly repo: Repository<TechnicianPayout>,
  ) {}

  async createPayout(
    data: Partial<TechnicianPayout>,
  ) {
    const payout = this.repo.create(data);
    return this.repo.save(payout);
  }

  async findExistingPayout(
    bookingId: number,
    technicianId: number,
  ) {
    return this.repo.findOne({
      where: {
        bookingId,
        technicianId,
      },
    });
  }

  async findByPaymentRecordId(
    paymentRecordId: number,
  ) {
    return this.repo.findOne({
      where: {
        paymentRecordId,
      },
    });
  }

  async updatePayout(
    payout: TechnicianPayout,
  ) {
    return this.repo.save(payout);
  }
}