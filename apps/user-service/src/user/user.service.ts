import { ConflictException, ForbiddenException, Injectable, InternalServerErrorException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { DataSource, QueryRunner } from 'typeorm';
import { last, single } from 'rxjs';
import { UserRepository, OtpRepository, TechnicianProfileRepository, ServiceRepository } from '@hichandra/repositories';
import {
    USER_ROLE,
    USER_STATUS,
    TECHNICIAN_STATUS,
    TechnicianService,
    TechnicianBrandExpertise,
    Service,
    PricingRule,
    PlatformSetting,
    TechnicianLocation,
    ServiceSpecification,
} from '@hichandra/entities';
import { AuthModuleService } from 'apps/auth-service/src/auth/auth-module.service';
import { S3Service } from '@hichandra/s3';
import { RegisterDto, UpdateUserDto, CreateServiceDto, CreatePlatformSettingDto } from '@hichandra/dtos';

@Injectable()
export class UserService {

    constructor(
        private readonly userRepository: UserRepository,
        private readonly otpRepository: OtpRepository,
        private readonly serviceRepository: ServiceRepository,
        private readonly technicianProfileRepository: TechnicianProfileRepository,
        private readonly dataSource: DataSource,
        private readonly authModuleService: AuthModuleService,
        private readonly s3Service: S3Service,
    ) { }

    async findById(id: number) {
        const user = await this.userRepository.findOne({
            where: { id },
            relations: [
                'technicianProfile',
                'technicianProfile.services',
                'technicianProfile.brandExpertise',
                'technicianProfile.locations',
            ],
        });
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

    async getAllUsersService(
        page: number,
        limit: number,
        role?: USER_ROLE,
        status?: USER_STATUS,
    ) {
        const { users, total } =
            await this.userRepository.findAllUsers(
                page,
                limit,
                role,
                status,
            );

        return {
            success: true,
            message: 'All users fetched successfully',
            data: users,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    async getUserByIdService(id: number) {
        const user = await this.userRepository.findById(id);

        if (!user) {
            throw new NotFoundException('User not found');
        }

        return user;
    }

    async updateUserService(
        id: number,
        updateUserDto: UpdateUserDto,
    ) {
        const user = await this.userRepository.findById(id);

        if (!user) {
            throw new Error('User not found');
        }

        const updatedUser = await this.userRepository.updateUser(
            id,
            updateUserDto,
        );

        return {
            success: true,
            message: 'User updated successfully',
            data: updatedUser,
        };
    }

    async deleteUserService(id: number) {
        const user = await this.userRepository.findById(id);

        if (!user) {
            throw new Error('User not found');
        }

        await this.userRepository.softDeleteUser(id);

        return {
            success: true,
            message: 'User deleted successfully',
        };
    }

    async getAllServices(
        page?: number,
        limit?: number,
    ) {
        const { services, total } =
            await this.serviceRepository.findAllServices(
                page,
                limit,
            );

        const formattedServices = await Promise.all(
            services.map(
                async (service) => {
                    let iconDownloadUrl;
                    if (service.iconUrl) {
                        // Generate download URL here
                        iconDownloadUrl = await this.s3Service.getDownloadUrl(service.iconUrl);
                    }
                    const serviceData = {
                        ...service,
                        iconDownloadUrl
                    };

                    return serviceData;
                },
            ),
        );

        const response: any = {
            success: true,
            message: 'Services fetched successfully',
            data: formattedServices,
        };

        if (page || limit) {
            const currentPage = page || 1;
            const currentLimit = limit || 10;

            response.pagination = {
                total,
                page: currentPage,
                limit: currentLimit,
                totalPages: Math.ceil(
                    total / currentLimit,
                ),
            };
        }

        return response;
    }

    async getServiceById(id: number) {
        const service =
            await this.serviceRepository.findServiceById(
                id,
            );

        if (!service) {
            throw new NotFoundException(
                'Service not found',
            );
        }

        const serviceData = {
            ...service,
        };

        (serviceData as any).iconDownloadUrl = undefined;
        if (service.iconUrl) {
            // Generate download URL here
            (serviceData as any).iconDownloadUrl = await this.s3Service.getDownloadUrl(service.iconUrl);
        }

        return {
            success: true,
            message: 'Service fetched successfully',
            data: serviceData,
        };
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
            message: 'Admin Registration successful',
            ...data,
        };
    }

    async userRegisterService(
        dto: RegisterDto,
        files?: {
            aadharUrl?: Express.Multer.File[];
            panUrl?: Express.Multer.File[];
            policeCertUrl?: Express.Multer.File[];
            tradeLicenseUrl?: Express.Multer.File[];
            selfieUrl?: Express.Multer.File[];
        },
    ) {
        if (!dto.email) {
            throw new BadRequestException('Email is required');
        }

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
            status: otpRecord.role === USER_ROLE.TECHNICIAN ? USER_STATUS.PENDING : USER_STATUS.ACTIVE,
        });

        let savedUser = await this.userRepository.save(newUser);

        if (savedUser.role === USER_ROLE.TECHNICIAN) {
            const profileData = dto.technicianProfile || {};
            let panUrl;
            let policeCertUrl;
            let tradeLicenseUrl;
            let selfieUrl;
            let aadharUrl;

            if (files?.panUrl?.[0]) {
                panUrl = await this.s3Service.uploadFileHelper(savedUser.id, 'pan', files?.panUrl);
            }
            if (files?.policeCertUrl?.[0]) {
                policeCertUrl = await this.s3Service.uploadFileHelper(savedUser.id, 'police-cert', files?.policeCertUrl);
            }
            if (files?.tradeLicenseUrl?.[0]) {
                tradeLicenseUrl = await this.s3Service.uploadFileHelper(savedUser.id, 'trade-license', files?.tradeLicenseUrl);
            }
            if (files?.selfieUrl?.[0]) {
                selfieUrl = await this.s3Service.uploadFileHelper(savedUser.id, 'selfie', files?.selfieUrl);
            }
            if (files?.aadharUrl?.[0]) {
                aadharUrl = await this.s3Service.uploadFileHelper(savedUser.id, 'aadhar', files?.aadharUrl);
            }

            const newProfile = this.technicianProfileRepository.create({
                userId: savedUser.id,
                address: profileData.address,
                yearsOfExperience: profileData.yearsOfExperience,
                languages: profileData.languages,
                serviceRadiusKm: profileData.serviceRadiusKm,
                preferredAreas: profileData.preferredAreas,
                pincodes: profileData.pincodes,
                status: TECHNICIAN_STATUS.INCOMPLETE,
                isAvailable: false,
                aadharUrl,
                panUrl,
                policeCertUrl,
                tradeLicenseUrl,
                selfieUrl,
                hasLadder: profileData.hasLadder || false,
                hasACGauges: profileData.hasACGauges || false,
                hasSafetyEquipment: profileData.hasSafetyEquipment || false,
                hasVehicle: profileData.hasVehicle || false,
                accountHolderName: profileData.accountHolderName || '',
                accountNumber: profileData.accountNumber || '',
                ifscCode: profileData.ifscCode || '',
                bankName: profileData.bankName || '',
                isVerified: false,
            });
            const savedProfile = await this.technicianProfileRepository.save(newProfile);

            // Save location
            const locationRepository = this.dataSource.getRepository(TechnicianLocation);
            const newLocation = locationRepository.create({
                technicianId: savedProfile.id,
                latitude: profileData.latitude ?? 0,
                longitude: profileData.longitude ?? 0,
                serviceRadiusKm: profileData.serviceRadiusKm ?? 0,
                fullAddress: profileData.address,
                city: profileData.city,
                state: profileData.state,
                pincode: profileData.pincode,
                isActive: true,
            });
            await locationRepository.save(newLocation);

            // Save services
            if (profileData.services && profileData.services.length > 0) {
                const servicesToSave = profileData.services.map((s) =>
                    this.dataSource.getRepository(TechnicianService).create({
                        technicianProfileId: savedProfile.id,
                        serviceId: s.serviceId,
                    })
                );
                await this.dataSource.getRepository(TechnicianService).save(servicesToSave);
            }


            // Save brand expertise
            if (profileData.brandExpertise && profileData.brandExpertise.length > 0) {
                const brandsToSave = profileData.brandExpertise.map((b) =>
                    this.dataSource.getRepository(TechnicianBrandExpertise).create({
                        technicianProfileId: savedProfile.id,
                        brandName: b.brandName,
                    })
                );
                await this.dataSource.getRepository(TechnicianBrandExpertise).save(brandsToSave);
            }

            savedUser.technicianProfileId = savedProfile.id;
            savedUser = await this.userRepository.save(savedUser);
        }

        const tokenData = await this.authModuleService.issueAuthTokens(savedUser);

        let userResponse: any = {
            id: savedUser.id,
            email: savedUser.email,
            username: savedUser.username,
            phone: savedUser.phone,
            firstName: savedUser.firstName,
            lastName: savedUser.lastName,
            role: savedUser.role,
            status: savedUser.status,
            createdAt: savedUser.createdAt,
            updatedAt: savedUser.updatedAt,
        };

        if (savedUser.role === USER_ROLE.TECHNICIAN) {
            const fullUser = await this.userRepository.findOne({
                where: { id: savedUser.id },
                relations: [
                    'technicianProfile',
                    'technicianProfile.services',
                    'technicianProfile.brandExpertise',
                    'technicianProfile.locations',
                ],
            });
            if (fullUser) {
                userResponse = {
                    ...userResponse,
                    technicianProfile: fullUser.technicianProfile,
                };
            }
        }

        return {
            message: 'Registration successful',
            tokens: tokenData.tokens,
            user: userResponse,
        };
    }

    async createServiceWithPricing(
        dto: CreateServiceDto,
        files?: {
            icon?: Express.Multer.File[];
        },
    ) {
        return this.dataSource.transaction(async (manager) => {
            const serviceRepository = manager.getRepository(Service);
            const pricingRuleRepository = manager.getRepository(PricingRule);

            const existingService = await serviceRepository.findOne({
                where: { name: dto.name },
            });
            if (existingService) {
                throw new ConflictException('Service with this name already exists');
            }

            let iconUrl = dto.iconUrl;
            if (files?.icon?.[0]) {
                const file = files.icon[0];
                const parts = file.originalname.split('.');
                const ext = parts.length > 1 ? `.${parts.pop()}` : '';
                const key = `services/icons/${dto.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}${ext}`;
                iconUrl = await this.s3Service.uploadFile(key, file.buffer, file.mimetype);
            }

            const newService = serviceRepository.create({
                name: dto.name,
                description: dto.description,
                isActive: dto.isActive !== undefined ? dto.isActive : true,
                iconUrl,
            });
            const savedService = await serviceRepository.save(newService);

            const pricingRule = pricingRuleRepository.create({
                serviceId: savedService.id,
                baseFare: dto.baseFare,
                perHourRate: dto.perHourRate ?? 0,
                perKmRate: dto.perKmRate ?? 0,
                weekendMultiplier: dto.weekendMultiplier ?? 1.0,
                peakHourMultiplier: dto.peakHourMultiplier ?? 1.0,
                peakHours: dto.peakHours,
                emergencyCharge: dto.emergencyCharge ?? 0,
                freeDistanceKm: dto.freeDistanceKm ?? 5,
                distanceChargePerKm: dto.distanceChargePerKm ?? 0,
                surgeFactor: dto.surgeFactor ?? 0,
                isSurgeEnabled: dto.isSurgeEnabled ?? false,
                platformFee: dto.platformFee ?? 0,
                gst: dto.gst ?? 0,
            });
            const savedPricingRule = await pricingRuleRepository.save(pricingRule);

            let savedSpecs: ServiceSpecification[] = [];
            if (dto.specifications && dto.specifications.length > 0) {
                const specRepository = manager.getRepository(ServiceSpecification);
                const specsToCreate = dto.specifications.map((spec) =>
                    specRepository.create({
                        serviceId: savedService.id,
                        name: spec.name,
                        type: spec.type,
                        values: spec.values,
                        isRequired: spec.isRequired ?? false,
                        isActive: spec.isActive ?? true,
                    })
                );
                savedSpecs = await specRepository.save(specsToCreate);
            }

            return {
                success: true,
                message: 'Service with pricing created successfully',
                data: {
                    service: savedService,
                    pricingRule: savedPricingRule,
                    specifications: savedSpecs,
                },
            };
        });
    }

    async upsertPlatformSetting(dto: CreatePlatformSettingDto) {
        const platformSettingRepository = this.dataSource.getRepository(PlatformSetting);

        let setting = await platformSettingRepository.findOne({
            where: { key: dto.key },
        });

        if (setting) {
            setting.value = dto.value;
            if (dto.description !== undefined) {
                setting.description = dto.description;
            }
        } else {
            setting = platformSettingRepository.create({
                key: dto.key,
                value: dto.value,
                description: dto.description,
            });
        }

        const savedSetting = await platformSettingRepository.save(setting);

        return {
            success: true,
            message: 'Platform setting saved successfully',
            data: savedSetting,
        };
    }
}