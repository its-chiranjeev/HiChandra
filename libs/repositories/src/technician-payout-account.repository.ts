import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TechnicianPayoutAccount } from '@hichandra/entities';
import { BaseRepository } from './baseDb.repository';

@Injectable()
export class TechnicianPayoutAccountRepository extends BaseRepository<TechnicianPayoutAccount> {
  constructor(
    @InjectRepository(TechnicianPayoutAccount)
    repo: Repository<TechnicianPayoutAccount>,
  ) {
    super(repo);
  }
}
