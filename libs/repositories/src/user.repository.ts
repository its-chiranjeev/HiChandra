import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '@hichandra/entities';
import { BaseRepository } from './baseDb.repository';

@Injectable()
export class UserRepository extends BaseRepository<User> {
  constructor(
    @InjectRepository(User)
    repo: Repository<User>,
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
      where: [{ email: normalized }, { username: normalized }],
    });
  }

    async findAllUsers(page = 1, limit = 10) {
  const [users, total] = await this.repo.findAndCount({
    select: {
      id: true,
      email: true,
      username: true,
      phone: true,
      firstName: true,
      lastName: true,
      profileImage: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
    skip: (page - 1) * limit,
    take: limit,
    order: {
      createdAt: 'DESC',
    },
  });

  return {
    users,
    total,
  };
}

async findById(id: number) {
  return this.repo.findOne({
    where: { id },
    select: {
      id: true,
      email: true,
      username: true,
      phone: true,
      firstName: true,
      lastName: true,
      profileImage: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true,
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
}
