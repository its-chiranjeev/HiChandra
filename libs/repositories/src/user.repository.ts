import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { User, CustomerAddress, USER_ROLE, USER_STATUS } from '@hichandra/entities';
import { BaseRepository } from './baseDb.repository';

@Injectable()
export class UserRepository extends BaseRepository<User> {
  constructor(
    @InjectRepository(User)
    repo: Repository<User>,

    @InjectRepository(CustomerAddress)
    private readonly addressRepository: Repository<CustomerAddress>,
  ) {
    super(repo);
  }

  // Only user-specific queries here

  async findByEmail(email: string) {
    return this.repo.findOne({
      where: { email },
    });
  }

  async findByEmailOrUsername(identifier: string) {
    const normalized = identifier.trim().toLowerCase();
    return this.repo.findOne({
      where: [{ email: normalized }],
    });
  }

  async findAllUsers(
    page = 1,
    limit = 10,
    role?: USER_ROLE,
    status?: USER_STATUS,
  ) {
    const where: any = {
      role: Not(USER_ROLE.ADMIN),
    };

    if (status) {
      where.status = status;
    }

    const [users, total] = await this.repo.findAndCount({
      where,
      relations: {
        technicianProfile: {
          services: true,
          brandExpertise: true,
          locations: true,
        },
        addresses: true,
      },
      skip: (page - 1) * limit,
      take: limit,
      order: {
        createdAt: 'DESC',
      },
    });

    return { users, total };
  }

  async findById(id: number) {
    return this.repo.findOne({
      where: {
        id,
        role: Not(USER_ROLE.ADMIN),
      },
      relations: {
        technicianProfile: {
          services: true,
          brandExpertise: true,
          locations: true,
        },
        addresses: true,
      },
    });
  }
  async findTechnicianById(id: number) {
    return this.repo.findOne({
      where: {
        id,
        role: USER_ROLE.TECHNICIAN,
        status: USER_STATUS.ACTIVE,
      },
      relations: {
        technicianProfile: {
          services: true,
          brandExpertise: true,
          locations: true,
        },
      },
    });
  }
  
  async updateUser(
    id: number,
    payload: Partial<User>,
  ) {
    await this.repo.update(id, payload);

    return this.repo.findOne({
      where: { id },
    });
  }

  async softDeleteUser(id: number) {
    return this.repo.softDelete(id);
  }

  async saveUser(user: User): Promise<User> {
    return this.repo.save(user);
  }

  async findCustomerAddresses(userId: number) {
    return this.addressRepository.find({
      where: {
        userId,
        isActive: true,
      },
      order: {
        isDefault: 'DESC',
        createdAt: 'DESC',
      },
    });
  }
}
