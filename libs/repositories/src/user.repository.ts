import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { User, CustomerAddress, USER_ROLE, USER_STATUS, Booking, BOOKING_STATUS, TECHNICIAN_STATUS } from '@hichandra/entities';
import { BaseRepository } from './baseDb.repository';
import { Brackets } from 'typeorm';

@Injectable()
export class UserRepository extends BaseRepository<User> {
  constructor(
    @InjectRepository(User)
    repo: Repository<User>,

    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,

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

  // async findAllUsers(
  //   page = 1,
  //   limit = 10,
  //   role?: USER_ROLE,
  //   status?: USER_STATUS,
  // ) {
  //   // const where: any = {
  //   //   role: Not(USER_ROLE.ADMIN),
  //   // };

  //   const where: any = {};

  //   if (role) {
  //     where.role = role;
  //   } else {
  //     where.role = Not(USER_ROLE.ADMIN);
  //   }

  //   if (status) {
  //     where.status = status;
  //   }

  //   const [users, total] = await this.repo.findAndCount({
  //     where,
  //     relations: {
  //       technicianProfile: {
  //         services: true,
  //         brandExpertise: true,
  //         locations: true,
  //       },
  //       addresses: true,
  //     },
  //     skip: (page - 1) * limit,
  //     take: limit,
  //     order: {
  //       createdAt: 'DESC',
  //     },
  //   });

  //   return { users, total };
  // }

  async findAllUsers(
    page = 1,
    limit = 10,
    role?: USER_ROLE,
    status?: USER_STATUS,
    technicianProfileStatus?: TECHNICIAN_STATUS,
  ) {
    const query = this.repo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.technicianProfile', 'technicianProfile')
      .leftJoinAndSelect('technicianProfile.services', 'services')
      .leftJoinAndSelect('technicianProfile.brandExpertise', 'brandExpertise')
      .leftJoinAndSelect('technicianProfile.locations', 'locations')
      .leftJoinAndSelect('user.addresses', 'addresses')
      .where('user.role != :adminRole', {
        adminRole: USER_ROLE.ADMIN,
      });

    if (role) {
      query.andWhere('user.role = :role', { role });
    }

    if (status) {
      query.andWhere('user.status = :status', { status });
    }

    if (technicianProfileStatus) {
      query.andWhere(
        new Brackets((qb) => {
          qb.where('user.role = :customerRole', {
            customerRole: USER_ROLE.CUSTOMER,
          }).orWhere(
            new Brackets((subQb) => {
              subQb
                .where('user.role = :technicianRole', {
                  technicianRole: USER_ROLE.TECHNICIAN,
                })
                .andWhere(
                  'technicianProfile.status = :technicianProfileStatus',
                  { technicianProfileStatus },
                );
            }),
          );
        }),
      );
    }

    const [users, total] = await query
      .orderBy('user.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { users, total };
  }

  async findById(id: number) {
    return this.repo.findOne({
      where: {
        id
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

  async getCustomerDashboardStats(userId: number) {
    const [
      totalBookings,
      upcomingBookings,
      activeBookings,
      savedAddresses,
    ] = await Promise.all([
      this.bookingRepository.count({
        where: { customerId: userId },
      }),

      this.bookingRepository.count({
        where: {
          customerId: userId,
          status: BOOKING_STATUS.PENDING,
        },
      }),

      this.bookingRepository.count({
        where: [
          {
            customerId: userId,
            status: BOOKING_STATUS.ACCEPTED,
          },
          {
            customerId: userId,
            status: BOOKING_STATUS.ENROUTE,
          },
          {
            customerId: userId,
            status: BOOKING_STATUS.ARRIVED,
          },
          {
            customerId: userId,
            status: BOOKING_STATUS.ONGOING,
          },
        ],
      }),

      this.addressRepository.count({
        where: {
          userId,
          isActive: true,
        },
      }),
    ]);

    return {
      totalBookings,
      upcomingBookings,
      activeBookings,
      savedAddresses,
    };
  }
}
