import { ConflictException, ForbiddenException, Injectable, InternalServerErrorException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { DataSource, QueryRunner } from 'typeorm';
import { last, single } from 'rxjs';
import { UserRepository } from '@hichandra/repositories';

type AuditMeta = {
    actorUserId?: number;
    // actorRole?: USER_ROLE;
    ipAddress?: string;
    userAgent?: string;
};


@Injectable()
export class UserService {

    constructor(
        private readonly userRepository: UserRepository,
        private readonly dataSource: DataSource
    ) { }

    async findById(id: number) {
        const user = await this.userRepository.findById(id);
        if (!user) {
            throw new NotFoundException('User not found');
        }
        const { 
            password: _pass, 
            id: _id, 
            hashedRefreshToken: _refreshToken, 
            ...rest 
        } = user;
        return rest;
    }
    async getAllUsers(page: number, limit: number) {
  const { users, total } =
    await this.userRepository.findAllUsers(page, limit);

  return {
    data: users,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}
}