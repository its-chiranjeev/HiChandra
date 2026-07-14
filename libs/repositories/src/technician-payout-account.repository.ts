import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {TechnicianPayoutAccount} from '@hichandra/entities';
import { BaseRepository } from './baseDb.repository';

@Injectable()
export class TechnicianPayoutAccountRepository extends BaseRepository<TechnicianPayoutAccount> {
  constructor(
    @InjectRepository(TechnicianPayoutAccount)
    repo: Repository<TechnicianPayoutAccount>,
  ) {
    super(repo);
  }

  async findByTechnicianId(
    technicianId: number,
  ): Promise<TechnicianPayoutAccount | null> {
    return this.repo.findOne({
      where: {
        technicianId,
      },
    });
  }

  async deleteByTechnicianId(
    technicianId: number,
  ): Promise<void> {
    await this.repo.delete({
      technicianId,
    });
  }
  
  async findByFundAccountId(
    razorpayFundAccountId: string,
  ): Promise<TechnicianPayoutAccount | null> {
    return this.repo.findOne({
      where: {
        razorpayFundAccountId,
      },
    });
  }
}