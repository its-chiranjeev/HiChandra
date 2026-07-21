import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, ILike } from 'typeorm';

import { Service, ServiceSpecification } from '@hichandra/entities';
import { BaseRepository } from './baseDb.repository';

@Injectable()
export class ServiceRepository extends BaseRepository<Service> {
  constructor(
    @InjectRepository(Service)
    repo: Repository<Service>,
  ) {
    super(repo);
  }

  async findAllServices(
    page?: number,
    limit?: number,
    isAdmin?: boolean,
    search?: string,
    status?: string,
  ) {
    const whereCondition: any = {
      deletedAt: IsNull(),
    };

    if (!isAdmin) {
      whereCondition.isActive = true;
    } else {
      if (status !== undefined && status !== null && String(status).trim() !== '') {
        const normalizedStatus = String(status).trim().toLowerCase();
        if (normalizedStatus === 'true' || normalizedStatus === '1') {
          whereCondition.isActive = true;
        } else if (normalizedStatus === 'false' || normalizedStatus === '0') {
          whereCondition.isActive = false;
        }
      }
    }

    if (search && search.trim() !== '') {
      whereCondition.name = ILike(`%${search.trim()}%`);
    }

    const queryOptions: any = {
      where: whereCondition,
      relations: {
        pricingRule: true,
        specifications: true,
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
        specifications: true,
      },
    });
  }

  async softDeleteService(id: number) {
    return this.repo.softDelete(id);
  }
}
