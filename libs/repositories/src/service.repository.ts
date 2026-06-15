import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Service } from '@hichandra/entities';
import { BaseRepository } from './baseDb.repository';

@Injectable()
export class ServiceRepository extends BaseRepository<Service> {
  constructor(
    @InjectRepository(Service)
    repo: Repository<Service>,
  ) {
    super(repo);
  }

  async findAllServices(page?: number, limit?: number) {
    const queryOptions: any = {
      where: {
        isActive: true,
      },
      relations: {
        pricingRule: true,
      },
      order: {
        createdAt: 'DESC',
      },
    };

    if (page || limit) {
      const currentPage = page || 1;
      const currentLimit = limit || 10;

      queryOptions.skip = (currentPage - 1) * currentLimit;

      queryOptions.take = currentLimit;
    }

    const [services, total] = await this.repo.findAndCount(queryOptions);

    return {
      services,
      total,
    };
  }

  async findServiceById(id: number) {
    return this.repo.findOne({
      where: {
        id,
        isActive: true,
      },
      relations: {
        pricingRule: true,
      },
    });
  }
}
