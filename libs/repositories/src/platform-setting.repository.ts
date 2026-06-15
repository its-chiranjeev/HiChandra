import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PlatformSetting } from '@hichandra/entities';
import { BaseRepository } from './baseDb.repository';
import { ILike } from 'typeorm';

@Injectable()
export class PlatformSettingRepository extends BaseRepository<PlatformSetting> {
  constructor(
    @InjectRepository(PlatformSetting)
    repo: Repository<PlatformSetting>,
  ) {
    super(repo);
  }

  async findAllPlatformSettings(page = 1, limit = 10, filter?: string) {
    const where = filter
      ? {
          key: ILike(`%${filter}%`),
        }
      : {};

    const [settings, total] = await this.repo.findAndCount({
      where,
      order: {
        createdAt: 'DESC',
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      settings,
      total,
    };
  }

  async findById(id: number) {
    return this.repo.findOne({
      where: { id },
    });
  }
}
