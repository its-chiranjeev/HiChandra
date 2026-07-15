import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TechnicianProfile,   TECHNICIAN_STATUS, USER_ROLE, USER_STATUS } from '@hichandra/entities';
import { BaseRepository } from './baseDb.repository';

@Injectable()
export class TechnicianProfileRepository extends BaseRepository<TechnicianProfile> {
  constructor(
    @InjectRepository(TechnicianProfile)
    repo: Repository<TechnicianProfile>,
  ) {
    super(repo);
  }

  async countActiveTechnicians(): Promise<number> {
    return this.repo.createQueryBuilder('technicianProfile')
      .innerJoin(
        'technicianProfile.user',
        'user',
      )
      .where(
        'user.role = :role',
        {
          role: USER_ROLE.TECHNICIAN,
        },
      )
      .andWhere(
        'user.status = :userStatus',
        {
          userStatus: USER_STATUS.ACTIVE,
        },
      )
      .andWhere(
        'technicianProfile.status = :profileStatus',
        {
          profileStatus:
            TECHNICIAN_STATUS.APPROVED,
        },
      )
      .getCount();
  }

  async countPendingApprovals(): Promise<number> {
    return this.repo.count({
      where: {
        status:
          TECHNICIAN_STATUS.PENDING_APPROVAL,
      },
    });
  }
}
