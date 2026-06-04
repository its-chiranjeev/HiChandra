import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TechnicianProfile } from '@hichandra/entities';
import { BaseRepository } from './baseDb.repository';

@Injectable()
export class TechnicianProfileRepository extends BaseRepository<TechnicianProfile> {
  constructor(
    @InjectRepository(TechnicianProfile)
    repo: Repository<TechnicianProfile>,
  ) {
    super(repo);
  }
}
