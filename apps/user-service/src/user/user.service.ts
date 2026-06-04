import { ConflictException, ForbiddenException, Injectable, InternalServerErrorException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { DataSource, QueryRunner } from 'typeorm';
import { last, single } from 'rxjs';
import { UserRepository, OtpRepository } from '@hichandra/repositories';
import { RegisterDto } from '@hichandra/dtos';
import { USER_ROLE, USER_STATUS } from '@hichandra/entities';
import { AuthModuleService } from 'apps/auth-service/src/auth/auth-module.service';

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
        private readonly otpRepository: OtpRepository,
        private readonly dataSource: DataSource,
        private readonly authModuleService: AuthModuleService,
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

    async adminRegisterService(dto: RegisterDto) {
        const existingUser = await this.userRepository.findByEmail(dto.email);
        if (existingUser) {
            throw new ConflictException('Email already in use');
        }

        if (dto.username) {
            const existingUserByUsername = await this.userRepository.findOne({
                where: { username: dto.username },
            });
            if (existingUserByUsername) {
                throw new ConflictException('Username already in use');
            }
        }

        if (dto.phone) {
            const existingUserByPhone = await this.userRepository.findOne({
                where: { phone: dto.phone },
            });
            if (existingUserByPhone) {
                throw new ConflictException('Phone number already in use');
            }
        }

        const hashedPassword = await bcrypt.hash(dto.password, 10);

        const newUser = this.userRepository.create({
            email: dto.email,
            username: dto.username,
            ...(dto.phone && { phone: dto.phone }),
            firstName: dto.firstName,
            lastName: dto.lastName,
            password: hashedPassword,
            role: USER_ROLE.ADMIN
        });

        const savedUser = await this.userRepository.save(newUser);

        const data = await this.authModuleService.issueAuthTokens(savedUser);

        return {
            message: 'Registration successful',
            ...data,
        };
    }

    async userRegisterService(dto: RegisterDto) {
        if (!dto.email) {
            throw new BadRequestException('Email is required');
        }
        // if (!dto.phone) {
        //     throw new BadRequestException('Phone number is required');
        // }

        const existingUser = await this.userRepository.findByEmail(dto.email);
        if (existingUser) {
            throw new ConflictException('Email already in use');
        }

        if (dto.username) {
            const existingUserByUsername = await this.userRepository.findOne({
                where: { username: dto.username },
            });
            if (existingUserByUsername) {
                throw new ConflictException('Username already in use');
            }
        }

        const existingUserByPhone = await this.userRepository.findOne({
            where: { phone: dto.phone },
        });
        if (existingUserByPhone) {
            throw new ConflictException('Phone number already in use');
        }

        const otpRecord = await this.otpRepository.findOne({
            where: { email: dto.email, phone: dto.phone },
        });

        if (!otpRecord) {
            throw new BadRequestException('OTP record not found for this email and phone');
        }

        if (!otpRecord.isVerified) {
            throw new ForbiddenException('OTP is not verified');
        }

        await this.otpRepository.delete(otpRecord.id);

        const hashedPassword = await bcrypt.hash(dto.password, 10);

        const newUser = this.userRepository.create({
            email: dto.email,
            username: dto.username,
            phone: dto.phone,
            firstName: dto.firstName,
            lastName: dto.lastName,
            password: hashedPassword,
            role: otpRecord.role || USER_ROLE.CUSTOMER,
            status: USER_STATUS.ACTIVE,
        });

        const savedUser = await this.userRepository.save(newUser);

        const data = await this.authModuleService.issueAuthTokens(savedUser);

        return {
            message: 'Registration successful',
            ...data,
        };
    }
}