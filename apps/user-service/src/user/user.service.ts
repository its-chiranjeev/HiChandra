import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnprocessableEntityException,
  Logger,
} from '@nestjs/common';
import { BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { DataSource, QueryRunner, Not } from 'typeorm';
import { last, single } from 'rxjs';
import {
  UserRepository,
  OtpRepository,
  TechnicianProfileRepository,
  ServiceRepository,
  PlatformSettingRepository,
  FavoriteTechnicianRepository,
  TechnicianPayoutAccountRepository,
  BookingRepository,
  PaymentRepository,
} from '@hichandra/repositories';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
  CustomerAddress,
  User,
  Otp,
  TechnicianProfile,
  JOB_STATUS,
  TechnicianPayoutAccount,
  PAYOUT_ACCOUNT_TYPE,
  PAYOUT_ONBOARDING_STATUS,
  Payment,
  PAYMENT_STATUS,
  PAYMENT_TYPE,
  Booking,
  BOOKING_STATUS,
} from '@hichandra/entities';
import { AuthModuleService } from 'apps/auth-service/src/auth/auth-module.service';
import { S3Service } from '@hichandra/s3';
import {
  RegisterDto,
  UpdateUserDto,
  CreateServiceDto,
  CreatePlatformSettingDto,
  CustomerAddressDto,
  UpdateCustomerAddressDto,
  UpdateProfileDto,
  UpdateServiceDto,
  UpdateTechnicianStatusDto,
  AdminCreateTechnicianDto,
  CreateTechnicianPayoutAccountDto,
  UpdateTechnicianPayoutAccountDto,
  UpdateTechnicianServicesDto,
  UpdateTechnicianLocationDto,
  UpdateTechnicianBrandExpertiseDto,
  CreateTechnicianLocationDto
} from '@hichandra/dtos';
import { RazorpayXService, PaymentService } from '@hichandra/payment';
import { SmsService } from '@hichandra/sms-services';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private readonly userRepository: UserRepository,
    private readonly otpRepository: OtpRepository,
    private readonly serviceRepository: ServiceRepository,
    private readonly platformSettingRepository: PlatformSettingRepository,
    private readonly technicianProfileRepository: TechnicianProfileRepository,
    private readonly dataSource: DataSource,
    private readonly authModuleService: AuthModuleService,
    private readonly s3Service: S3Service,
    private readonly favoriteTechnicianRepository: FavoriteTechnicianRepository,
    private readonly razorpayXService: RazorpayXService,
    private readonly paymentService: PaymentService,
    private readonly smsService: SmsService,
    private readonly technicianPayoutAccountRepository: TechnicianPayoutAccountRepository,
    private readonly bookingRepository: BookingRepository,
    private readonly paymentRepository: PaymentRepository,
  ) { }

  async findById(id: number) {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: [
        'technicianProfile',
        'technicianProfile.services',
        'technicianProfile.brandExpertise',
        'technicianProfile.locations',
        'addresses',
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

  private async presignUserS3Urls(user: any) {
    if (!user) return user;

    const updatedUser = { ...user };

    if (updatedUser.profileImage) {
      try {
        updatedUser.profileImage = await this.s3Service.getDownloadUrl(updatedUser.profileImage);
      } catch (error) {
        console.error('Failed to get download URL for profileImage', error);
      }
    }

    if (updatedUser.technicianProfile) {
      updatedUser.technicianProfile = { ...updatedUser.technicianProfile };
      const documentFields = [
        'aadharUrl',
        'panUrl',
        'policeCertUrl',
        'tradeLicenseUrl',
        'selfieUrl',
      ];

      for (const field of documentFields) {
        const urlValue = updatedUser.technicianProfile[field];
        if (typeof urlValue === 'string' && urlValue.trim() !== '') {
          try {
            updatedUser.technicianProfile[field] = await this.s3Service.getDownloadUrl(urlValue);
          } catch (error) {
            console.error(`Failed to get download URL for technicianProfile.${field}`, error);
          }
        }
      }
    }

    return updatedUser;
  }

  async getAllUsersService(
    page: number,
    limit: number,
    role?: USER_ROLE,
    status?: USER_STATUS,
    technicianProfileStatus?: TECHNICIAN_STATUS,
    serviceId?: number,
  ) {
    const { users, total } = await this.userRepository.findAllUsers(
      page,
      limit,
      role,
      status,
      technicianProfileStatus,
      serviceId,
    );
    const formattedUsers = await Promise.all(
      users.map(async (user) => {
        const {
          password,
          hashedRefreshToken,
          tokenVersion,
          technicianProfileId,
          technicianProfile,
          addresses,
          ...safeUser
        } = user;

        let baseUser: any = { ...safeUser };

        if (user.role === USER_ROLE.CUSTOMER) {
          baseUser = {
            ...safeUser,
            addresses: addresses || [],
          };
        } else if (user.role === USER_ROLE.TECHNICIAN) {
          baseUser = {
            ...safeUser,
            technicianProfileId,
            technicianProfile,
          };
        }

        return this.presignUserS3Urls(baseUser);
      }),
    );
    return {
      success: true,
      message: 'All users fetched successfully',
      data: formattedUsers,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getUserByIdService(id: number) {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: [
        'addresses',
        'technicianProfile',
        'technicianProfile.services',
        'technicianProfile.services.service',
        'technicianProfile.services.service.specifications',
        'technicianProfile.services.service.pricingRule',
        'technicianProfile.brandExpertise',
        'technicianProfile.locations',
      ],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.profileImage) {
      try {
        user.profileImage = await this.s3Service.getDownloadUrl(user.profileImage);
      } catch (error) {
        this.logger.error(`Failed to get presigned URL for user profileImage`, error);
      }
    }

    let formattedTechnicianProfile: any = null;

    if (user.technicianProfile) {
      formattedTechnicianProfile = { ...user.technicianProfile };

      const documentFields = [
        'panUrl',
        'policeCertUrl',
        'tradeLicenseUrl',
        'selfieUrl',
        'aadharUrl',
      ];

      for (const field of documentFields) {
        const urlValue = formattedTechnicianProfile[field];
        if (typeof urlValue === 'string' && urlValue.trim() !== '') {
          try {
            formattedTechnicianProfile[field] =
              await this.s3Service.getDownloadUrl(urlValue);
          } catch (error) {
            this.logger.error(`Failed to get download URL for technicianProfile.${field}`, error);
          }
        }
      }

      if (formattedTechnicianProfile.services && Array.isArray(formattedTechnicianProfile.services)) {
        for (const techService of formattedTechnicianProfile.services) {
          if (techService?.service?.iconUrl) {
            try {
              techService.service.iconUrl =
                await this.s3Service.getDownloadUrl(techService.service.iconUrl);
            } catch (error) {
              this.logger.error(`Failed to get icon download URL for service ${techService.service.id}`, error);
            }
          }
        }
      }

      const payoutAccounts = await this.dataSource
        .getRepository(TechnicianPayoutAccount)
        .find({ where: { technicianId: user.id } });

      formattedTechnicianProfile.payoutAccounts = payoutAccounts || [];
    }

    const {
      password,
      hashedRefreshToken,
      tokenVersion,
      technicianProfile,
      addresses,
      ...safeUser
    } = user;

    const formattedUser = {
      ...safeUser,
      addresses: user.addresses || [],
      technicianProfile: formattedTechnicianProfile,
    };

    return {
      success: true,
      message: 'User fetched successfully',
      data: formattedUser,
    };
  }

  async updateUserService(id: number, updateUserDto: UpdateUserDto) {
    const user = await this.userRepository.findById(id);

    if (!user) {
      throw new Error('User not found');
    }

    const updatedUser = await this.userRepository.updateUser(id, updateUserDto);

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
    isAdmin?: boolean,
    search?: string,
    status?: string,
  ) {
    const { services, total } = await this.serviceRepository.findAllServices(
      page,
      limit,
      isAdmin,
      search,
      status,
    );

    const serviceIds = services.map((s) => s.id);
    const statsMap = new Map<
      number,
      {
        totalBookings: number;
        pendingBookings: number;
        acceptedBookings: number;
        cancelledBookings: number;
        completedBookings: number;
      }
    >();

    if (serviceIds.length > 0) {
      const bookingStats = await this.dataSource
        .getRepository(Booking)
        .createQueryBuilder('booking')
        .select('booking.serviceId', 'serviceId')
        .addSelect('booking.status', 'status')
        .addSelect('COUNT(booking.id)', 'count')
        .where('booking.serviceId IN (:...serviceIds)', { serviceIds })
        .groupBy('booking.serviceId')
        .addGroupBy('booking.status')
        .getRawMany();

      for (const row of bookingStats) {
        const serviceId = Number(row.serviceId);
        const count = Number(row.count);
        const status = row.status;

        if (!statsMap.has(serviceId)) {
          statsMap.set(serviceId, {
            totalBookings: 0,
            pendingBookings: 0,
            acceptedBookings: 0,
            cancelledBookings: 0,
            completedBookings: 0,
          });
        }

        const stat = statsMap.get(serviceId)!;
        stat.totalBookings += count;

        if (status === BOOKING_STATUS.PENDING) {
          stat.pendingBookings += count;
        } else if (status === BOOKING_STATUS.ACCEPTED) {
          stat.acceptedBookings += count;
        } else if (status === BOOKING_STATUS.CANCELLED) {
          stat.cancelledBookings += count;
        } else if (status === BOOKING_STATUS.COMPLETED) {
          stat.completedBookings += count;
        }
      }
    }

    const formattedServices = await Promise.all(
      services.map(async (service) => {
        let iconDownloadUrl;
        if (service.iconUrl) {
          // Generate download URL here
          iconDownloadUrl = await this.s3Service.getDownloadUrl(
            service.iconUrl,
          );
        }

        const stats = statsMap.get(service.id) || {
          totalBookings: 0,
          pendingBookings: 0,
          acceptedBookings: 0,
          cancelledBookings: 0,
          completedBookings: 0,
        };

        const serviceData = {
          ...service,
          iconDownloadUrl,
          totalBookings: stats.totalBookings,
          pendingBookings: stats.pendingBookings,
          acceptedBookings: stats.acceptedBookings,
          cancelledBookings: stats.cancelledBookings,
          completedBookings: stats.completedBookings,
        };

        return serviceData;
      }),
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
        totalPages: Math.ceil(total / currentLimit),
      };
    }

    return response;
  }

  async getServiceById(id: number) {
    const service = await this.serviceRepository.findServiceById(id);

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    const bookingStats = await this.dataSource
      .getRepository(Booking)
      .createQueryBuilder('booking')
      .select('booking.status', 'status')
      .addSelect('COUNT(booking.id)', 'count')
      .where('booking.serviceId = :serviceId', { serviceId: id })
      .groupBy('booking.status')
      .getRawMany();

    const stats = {
      totalBookings: 0,
      pendingBookings: 0,
      acceptedBookings: 0,
      cancelledBookings: 0,
      completedBookings: 0,
    };

    for (const row of bookingStats) {
      const count = Number(row.count);
      const status = row.status;
      stats.totalBookings += count;

      if (status === BOOKING_STATUS.PENDING) {
        stats.pendingBookings += count;
      } else if (status === BOOKING_STATUS.ACCEPTED) {
        stats.acceptedBookings += count;
      } else if (status === BOOKING_STATUS.CANCELLED) {
        stats.cancelledBookings += count;
      } else if (status === BOOKING_STATUS.COMPLETED) {
        stats.completedBookings += count;
      }
    }

    let iconDownloadUrl;
    if (service.iconUrl) {
      iconDownloadUrl = await this.s3Service.getDownloadUrl(service.iconUrl);
    }

    const serviceData = {
      ...service,
      iconDownloadUrl,
      totalBookings: stats.totalBookings,
      pendingBookings: stats.pendingBookings,
      acceptedBookings: stats.acceptedBookings,
      cancelledBookings: stats.cancelledBookings,
      completedBookings: stats.completedBookings,
    };

    return {
      success: true,
      message: 'Service fetched successfully',
      data: serviceData,
    };
  }

  async deleteService(id: number) {
    const service = await this.serviceRepository.findOne({
      where: { id },
    });

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    service.isActive = false;
    await this.serviceRepository.save(service);

    await this.serviceRepository.softDeleteService(id);

    return {
      success: true,
      message: 'Service deleted successfully',
    };
  }

  async getAllPlatformSettingsService(
    page: number,
    limit: number,
    filter?: string,
  ) {
    const { settings, total } =
      await this.platformSettingRepository.findAllPlatformSettings(
        page,
        limit,
        filter,
      );

    return {
      success: true,
      message: 'Platform settings fetched successfully',
      data: settings,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getPlatformSettingByIdService(id: number) {
    const setting = await this.platformSettingRepository.findById(id);

    if (!setting) {
      throw new NotFoundException('Platform setting not found');
    }

    return {
      success: true,
      message: 'Platform setting fetched successfully',
      data: setting,
    };
  }

  async adminRegisterService(dto: RegisterDto) {
    // const existingUser = await this.userRepository.findByEmail(dto.email);
    // if (existingUser) {
    //   throw new ConflictException('Email already in use');
    // }
    const existingUserByPhone = await this.userRepository.findOne({
      where: { phone: dto.phone },
    });

    if (existingUserByPhone) {
      throw new ConflictException('Phone number already in use');
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
      role: USER_ROLE.ADMIN,
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
    // if (!dto.email) {
    //   throw new BadRequestException('Email is required');
    // }
    if (!dto.phone) {
      throw new BadRequestException('Phone number is required');
    }

    return this.dataSource.transaction(async (manager) => {
      const userRepository = manager.getRepository(User);
      const otpRepository = manager.getRepository(Otp);
      const technicianProfileRepository =
        manager.getRepository(TechnicianProfile);
      const locationRepository = manager.getRepository(TechnicianLocation);
      const technicianServiceRepository =
        manager.getRepository(TechnicianService);
      const technicianBrandExpertiseRepository = manager.getRepository(
        TechnicianBrandExpertise,
      );
      const customerAddressRepository = manager.getRepository(CustomerAddress);

      if (dto.phone) {
        const existingUserByPhone = await userRepository.findOne({
          where: { phone: dto.phone },
        });
        if (existingUserByPhone && (!dto.technicianId || existingUserByPhone.id !== Number(dto.technicianId))) {
          throw new ConflictException('Phone number already in use');
        }
      }

      if (dto.email) {
        const existingUserByEmail = await userRepository.findOne({
          where: { email: dto.email },
        });
        if (existingUserByEmail && (!dto.technicianId || existingUserByEmail.id !== Number(dto.technicianId))) {
          throw new ConflictException('Email already in use');
        }
      }

      if (dto.username) {
        const existingUserByUsername = await userRepository.findOne({
          where: { username: dto.username },
        });
        if (existingUserByUsername && (!dto.technicianId || existingUserByUsername.id !== Number(dto.technicianId))) {
          throw new ConflictException('Username already in use');
        }
      }

      // const otpRecord = await otpRepository.findOne({
      //   where: { email: dto.email, phone: dto.phone },
      // });
      const otpRecord = await otpRepository.findOne({
        where: { phone: dto.phone },
      });

      if (!otpRecord) {
        throw new BadRequestException(
          'OTP record not found for this phone number',
        );
      }

      if (!otpRecord.isVerified) {
        throw new ForbiddenException('OTP is not verified');
      }

      if (otpRecord.role === USER_ROLE.TECHNICIAN) {
        if (!files?.aadharUrl?.[0]) {
          throw new BadRequestException('Aadhaar document is required for technician registration');
        }
      }

      await otpRepository.delete(otpRecord.id);

      const hashedPassword = await bcrypt.hash(dto.password, 10);

      let savedUser: User;

      if (dto.technicianId) {
        const existingTechnician = await userRepository.findOne({
          where: { id: Number(dto.technicianId) },
        });
        if (!existingTechnician) {
          throw new NotFoundException('Technician user not found');
        }

        existingTechnician.email = dto.email;
        existingTechnician.username = dto.username;
        existingTechnician.phone = dto.phone;
        existingTechnician.firstName = dto.firstName;
        existingTechnician.lastName = dto.lastName;
        existingTechnician.password = hashedPassword;
        existingTechnician.role = otpRecord.role || USER_ROLE.CUSTOMER;

        savedUser = await userRepository.save(existingTechnician);
      } else {
        const newUser = userRepository.create({
          email: dto.email,
          username: dto.username,
          phone: dto.phone,
          firstName: dto.firstName,
          lastName: dto.lastName,
          password: hashedPassword,
          role: otpRecord.role || USER_ROLE.CUSTOMER,
        });

        savedUser = await userRepository.save(newUser);
      }

      if (savedUser.role === USER_ROLE.TECHNICIAN) {
        const profileData = dto.technicianProfile || {};
        let panUrl;
        let policeCertUrl;
        let tradeLicenseUrl;
        let selfieUrl;
        let aadharUrl;

        if (files?.panUrl?.[0]) {
          panUrl = await this.s3Service.uploadFileHelper(
            savedUser.id,
            'pan',
            files?.panUrl,
          );
        }
        if (files?.policeCertUrl?.[0]) {
          policeCertUrl = await this.s3Service.uploadFileHelper(
            savedUser.id,
            'police-cert',
            files?.policeCertUrl,
          );
        }
        if (files?.tradeLicenseUrl?.[0]) {
          tradeLicenseUrl = await this.s3Service.uploadFileHelper(
            savedUser.id,
            'trade-license',
            files?.tradeLicenseUrl,
          );
        }
        if (files?.selfieUrl?.[0]) {
          selfieUrl = await this.s3Service.uploadFileHelper(
            savedUser.id,
            'selfie',
            files?.selfieUrl,
          );
        }
        if (files?.aadharUrl?.[0]) {
          aadharUrl = await this.s3Service.uploadFileHelper(
            savedUser.id,
            'aadhar',
            files?.aadharUrl,
          );
        }

        const technicianPayoutAccountRepository = manager.getRepository(TechnicianPayoutAccount);

        let existingProfile = await technicianProfileRepository.findOne({
          where: { userId: savedUser.id },
        });

        let savedProfile: TechnicianProfile;

        if (existingProfile) {
          // Clean up old relations to prevent constraint duplicates or stale mappings
          await locationRepository.delete({ technicianId: existingProfile.id });
          await technicianServiceRepository.delete({ technicianProfileId: existingProfile.id });
          await technicianBrandExpertiseRepository.delete({ technicianProfileId: existingProfile.id });
          await technicianPayoutAccountRepository.delete({ technicianId: savedUser.id });

          existingProfile.yearsOfExperience = profileData.yearsOfExperience;
          existingProfile.languages = profileData.languages;
          existingProfile.status = TECHNICIAN_STATUS.PENDING_APPROVAL;
          existingProfile.jobStatus = JOB_STATUS.OFFLINE;
          if (aadharUrl) existingProfile.aadharUrl = aadharUrl;
          if (panUrl) existingProfile.panUrl = panUrl;
          if (policeCertUrl) existingProfile.policeCertUrl = policeCertUrl;
          if (tradeLicenseUrl) existingProfile.tradeLicenseUrl = tradeLicenseUrl;
          if (selfieUrl) existingProfile.selfieUrl = selfieUrl;
          existingProfile.gst = profileData.gst;
          existingProfile.hasLadder = profileData.hasLadder || false;
          existingProfile.hasACGauges = profileData.hasACGauges || false;
          existingProfile.hasSafetyEquipment = profileData.hasSafetyEquipment || false;
          existingProfile.hasVehicle = profileData.hasVehicle || false;

          savedProfile = await technicianProfileRepository.save(existingProfile);
        } else {
          const newProfile = technicianProfileRepository.create({
            userId: savedUser.id,
            yearsOfExperience: profileData.yearsOfExperience,
            languages: profileData.languages,
            status: TECHNICIAN_STATUS.PENDING_APPROVAL,
            jobStatus: JOB_STATUS.OFFLINE,
            aadharUrl,
            panUrl,
            policeCertUrl,
            tradeLicenseUrl,
            selfieUrl,
            gst: profileData.gst,
            hasLadder: profileData.hasLadder || false,
            hasACGauges: profileData.hasACGauges || false,
            hasSafetyEquipment: profileData.hasSafetyEquipment || false,
            hasVehicle: profileData.hasVehicle || false,
          });

          savedProfile = await technicianProfileRepository.save(newProfile);
        }

        if (
          profileData.upiId ||
          profileData.accountHolderName ||
          profileData.accountNumber ||
          profileData.ifscCode ||
          profileData.bankName
        ) {
          let accountType: PAYOUT_ACCOUNT_TYPE | undefined;
          if (profileData.upiId) {
            accountType = PAYOUT_ACCOUNT_TYPE.VPA;
          } else if (profileData.accountNumber) {
            accountType = PAYOUT_ACCOUNT_TYPE.BANK_ACCOUNT;
          }

          const payoutAccount = technicianPayoutAccountRepository.create({
            technicianId: savedUser.id,
            upiId: profileData.upiId,
            accountHolderName: profileData.accountHolderName,
            bankName: profileData.bankName,
            accountNumber: profileData.accountNumber,
            ifscCode: profileData.ifscCode,
            accountType,
            status: PAYOUT_ONBOARDING_STATUS.PENDING,
            isActive: false,
          });
          await technicianPayoutAccountRepository.save(payoutAccount);
        }

        // Save location
        const newLocation = locationRepository.create({
          technicianId: savedProfile.id,
          latitude: profileData.latitude ?? 0,
          longitude: profileData.longitude ?? 0,
          currentLat: profileData.latitude ?? 0,
          currentLng: profileData.longitude ?? 0,
          locationUpdatedAt: new Date(),
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
            technicianServiceRepository.create({
              technicianProfileId: savedProfile.id,
              serviceId: s.serviceId,
            }),
          );
          await technicianServiceRepository.save(servicesToSave);
        }

        // Save brand expertise
        if (
          profileData.brandExpertise &&
          profileData.brandExpertise.length > 0
        ) {
          const brandsToSave = profileData.brandExpertise.map((b) =>
            technicianBrandExpertiseRepository.create({
              technicianProfileId: savedProfile.id,
              brandName: b.brandName,
            }),
          );
          await technicianBrandExpertiseRepository.save(brandsToSave);
        }

        savedUser.technicianProfileId = savedProfile.id;
        savedUser = await userRepository.save(savedUser);
      }

      if (savedUser.role === USER_ROLE.CUSTOMER && dto.customerAddress) {
        const newAddress = customerAddressRepository.create({
          userId: savedUser.id,
          latitude: dto.customerAddress.latitude,
          longitude: dto.customerAddress.longitude,
          fullAddress: dto.customerAddress.fullAddress,
          city: dto.customerAddress.city,
          state: dto.customerAddress.state,
          pincode: dto.customerAddress.pincode,
          label: dto.customerAddress.label || 'Home',
          isDefault: true,
          isActive: true,
        });
        await customerAddressRepository.save(newAddress);
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
        const fullUser = await userRepository.findOne({
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

      if (savedUser.role === USER_ROLE.CUSTOMER) {
        const fullUser = await userRepository.findOne({
          where: { id: savedUser.id },
          relations: ['addresses'],
        });
        if (fullUser) {
          userResponse = {
            ...userResponse,
            addresses: fullUser.addresses,
          };
        }
      }

      return {
        message: 'Registration successful',
        tokens: tokenData.tokens,
        user: userResponse,
      };
    });
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
        iconUrl = await this.s3Service.uploadFile(
          key,
          file.buffer,
          file.mimetype,
        );
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
        serviceBasePrice: dto.serviceBasePrice ?? 0,
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
        isGstApplied: dto.isGstApplied ?? false,
        isDistanceKmApplied: dto.isDistanceKmApplied ?? false,
        isWeekendApplied: dto.isWeekendApplied ?? false,
        isPeakHourApplied: dto.isPeakHourApplied ?? false,
        isEmergencyApplied: dto.isEmergencyApplied ?? false,
        isPlatformFeeApplied: dto.isPlatformFeeApplied ?? false,
        isPerHourRateApplied: dto.isPerHourRateApplied ?? false,
        isServiceBasePriceApplied: dto.isServiceBasePriceApplied ?? true,
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
          }),
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
    const platformSettingRepository =
      this.dataSource.getRepository(PlatformSetting);

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

  async addCustomerAddressService(userId: number, dto: CustomerAddressDto) {
    return this.dataSource.transaction(async (manager) => {
      const addressRepository = manager.getRepository(CustomerAddress);

      // If this is the user's first address or explicitly marked as default,
      // we will set all other addresses for this user to default: false.
      const existingCount = await addressRepository.count({
        where: { userId, isActive: true },
      });

      const isDefault = dto.isDefault || existingCount === 0;

      if (isDefault) {
        await addressRepository.update({ userId }, { isDefault: false });
      }

      const newAddress = addressRepository.create({
        userId,
        latitude: dto.latitude,
        longitude: dto.longitude,
        fullAddress: dto.fullAddress,
        city: dto.city,
        state: dto.state,
        pincode: dto.pincode,
        label: dto.label || 'Home',
        isDefault,
        isActive: true,
      });

      const savedAddress = await addressRepository.save(newAddress);

      return {
        success: true,
        message: 'Address added successfully',
        data: savedAddress,
      };
    });
  }

  async updateCustomerAddressService(
    userId: number,
    addressId: number,
    dto: UpdateCustomerAddressDto,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const addressRepository = manager.getRepository(CustomerAddress);

      const address = await addressRepository.findOne({
        where: { id: addressId, userId, isActive: true },
      });

      if (!address) {
        throw new NotFoundException('Address not found');
      }

      // If we are changing the default address to true
      if (dto.isDefault === true && !address.isDefault) {
        // Set all other addresses for this user to default: false
        await addressRepository.update({ userId }, { isDefault: false });
      }

      const willBeDeactivated = dto.isActive === false;
      const willBeUnsetDefault = dto.isDefault === false;

      // If this is/was the default address and it's being deactivated or unset
      if ((willBeDeactivated || willBeUnsetDefault) && address.isDefault) {
        address.isDefault = false;
        // Find another active address to promote to default
        const anotherAddress = await addressRepository.findOne({
          where: { userId, id: Not(addressId), isActive: true },
          order: { createdAt: 'DESC' },
        });
        if (anotherAddress) {
          anotherAddress.isDefault = true;
          await addressRepository.save(anotherAddress);
        }
      }

      // Save the updated address fields
      const updatedAddress = await addressRepository.save({
        ...address,
        ...dto,
      });

      return {
        success: true,
        message: 'Address updated successfully',
        data: updatedAddress,
      };
    });
  }

  async deleteCustomerAddressService(userId: number, addressId: number) {
    return this.dataSource.transaction(async (manager) => {
      const addressRepository = manager.getRepository(CustomerAddress);

      const address = await addressRepository.findOne({
        where: { id: addressId, userId, isActive: true },
      });

      if (!address) {
        throw new NotFoundException('Address not found');
      }

      const wasDefault = address.isDefault;

      // Hard delete the address from the database
      await addressRepository.delete(addressId);

      // Promote another active address to default if the deleted one was default
      if (wasDefault) {
        const anotherAddress = await addressRepository.findOne({
          where: { userId, id: Not(addressId), isActive: true },
          order: { createdAt: 'DESC' },
        });
        if (anotherAddress) {
          anotherAddress.isDefault = true;
          await addressRepository.save(anotherAddress);
        }
      }

      return {
        success: true,
        message: 'Address deleted successfully',
      };
    });
  }

  async updateProfileService(
    userId: number,
    dto: UpdateProfileDto,
    files?: {
      profileImage?: Express.Multer.File[];
      pan?: Express.Multer.File[];
      policeCert?: Express.Multer.File[];
      tradeLicense?: Express.Multer.File[];
      selfie?: Express.Multer.File[];
    },
  ) {
    return this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      const profileRepo = manager.getRepository(TechnicianProfile);
      const locationRepo = manager.getRepository(TechnicianLocation);
      const techServiceRepo = manager.getRepository(TechnicianService);
      const brandRepo = manager.getRepository(TechnicianBrandExpertise);
      const serviceRepo = manager.getRepository(Service);

      const user = await userRepo.findOne({
        where: { id: userId },
        relations: ['technicianProfile'],
      });
      if (!user) {
        throw new NotFoundException('User not found');
      }

      const hasTechFields = !!dto.technicianProfile;
      if (hasTechFields && user.role !== USER_ROLE.TECHNICIAN) {
        throw new BadRequestException(
          'Only technicians can update technician-specific profile fields',
        );
      }

      if (dto.username && dto.username !== user.username) {
        const existing = await userRepo.findOne({
          where: { username: dto.username },
        });
        if (existing) {
          throw new ConflictException('Username already in use');
        }
        user.username = dto.username;
      }
      if (dto.phone && dto.phone !== user.phone) {
        const existing = await userRepo.findOne({
          where: { phone: dto.phone },
        });
        if (existing) {
          throw new ConflictException('Phone number already in use');
        }
        user.phone = dto.phone;
      }
      if (dto.email && dto.email !== user.email) {
        const existing = await userRepo.findOne({
          where: { email: dto.email },
        });
        if (existing) {
          throw new ConflictException('Email address already in use');
        }
        user.email = dto.email;
      }

      if (dto.password) {
        user.password = await bcrypt.hash(dto.password, 10);
      }

      if (dto.firstName !== undefined) user.firstName = dto.firstName;
      if (dto.lastName !== undefined) user.lastName = dto.lastName;
      if (dto.emergencyContact !== undefined)
        user.emergencyContact = dto.emergencyContact;

      if (files?.profileImage?.[0]) {
        const uploadedUrl = await this.s3Service.uploadFileHelper(
          user.id,
          'profile-image',
          files.profileImage,
        );

        if (uploadedUrl) {
          user.profileImage = uploadedUrl;
        }
      } else if (dto.profileImage !== undefined) {
        user.profileImage = dto.profileImage;
      }

      await userRepo.save(user);
      if (user.role === USER_ROLE.TECHNICIAN) {
        let profile = user.technicianProfile;
        if (!profile) {
          profile = profileRepo.create({
            userId: user.id,
            status: TECHNICIAN_STATUS.PENDING_APPROVAL,
          });
          profile = await profileRepo.save(profile);
          await userRepo.save(user);
        }

        if (dto.technicianProfile) {
          const profileData = dto.technicianProfile;
          if (profileData.yearsOfExperience !== undefined)
            profile.yearsOfExperience = profileData.yearsOfExperience;
          if (profileData.languages !== undefined)
            profile.languages = profileData.languages;
          if (profileData.gst !== undefined)
            profile.gst = profileData.gst;
          if (profileData.hasLadder !== undefined)
            profile.hasLadder = profileData.hasLadder;
          if (profileData.hasACGauges !== undefined)
            profile.hasACGauges = profileData.hasACGauges;
          if (profileData.hasSafetyEquipment !== undefined)
            profile.hasSafetyEquipment = profileData.hasSafetyEquipment;
          if (profileData.hasVehicle !== undefined)
            profile.hasVehicle = profileData.hasVehicle;

        }


        if (files?.pan?.[0]) {
          const uploadedUrl = await this.s3Service.uploadFileHelper(
            user.id,
            'technician-pan',
            files.pan,
          );
          if (uploadedUrl) {
            profile.panUrl = uploadedUrl;
          }
        } else if (dto.technicianProfile?.panUrl !== undefined) {
          profile.panUrl = dto.technicianProfile.panUrl;
        }

        if (files?.policeCert?.[0]) {
          const uploadedUrl = await this.s3Service.uploadFileHelper(
            user.id,
            'technician-police-cert',
            files.policeCert,
          );
          if (uploadedUrl) {
            profile.policeCertUrl = uploadedUrl;
          }
        } else if (dto.technicianProfile?.policeCertUrl !== undefined) {
          profile.policeCertUrl = dto.technicianProfile.policeCertUrl;
        }

        if (files?.tradeLicense?.[0]) {
          const uploadedUrl = await this.s3Service.uploadFileHelper(
            user.id,
            'technician-trade-license',
            files.tradeLicense,
          );
          if (uploadedUrl) {
            profile.tradeLicenseUrl = uploadedUrl;
          }
        } else if (dto.technicianProfile?.tradeLicenseUrl !== undefined) {
          profile.tradeLicenseUrl = dto.technicianProfile.tradeLicenseUrl;
        }

        if (files?.selfie?.[0]) {
          const uploadedUrl = await this.s3Service.uploadFileHelper(
            user.id,
            'technician-selfie',
            files.selfie,
          );
          if (uploadedUrl) {
            profile.selfieUrl = uploadedUrl;
          }
        } else if (dto.technicianProfile?.selfieUrl !== undefined) {
          profile.selfieUrl = dto.technicianProfile.selfieUrl;
        }

        await profileRepo.save(profile);
      }

      const updatedUser = await userRepo.findOne({
        where: { id: userId },
        relations: [
          'technicianProfile',
          'technicianProfile.services',
          'technicianProfile.brandExpertise',
          'technicianProfile.locations',
          'addresses',
        ],
      });

      if (updatedUser) {
        const {
          password: _pass,
          hashedRefreshToken: _token,
          ...cleanUser
        } = updatedUser;
        return {
          success: true,
          message: 'Profile updated successfully',
          data: cleanUser,
        };
      }

      return {
        success: true,
        message: 'Profile updated successfully',
      };
    });
  }

  async updateService(
    id: number,
    dto: UpdateServiceDto,
    files?: {
      icon?: Express.Multer.File[];
    },
  ) {
    return this.dataSource.transaction(async (manager) => {
      const serviceRepo = manager.getRepository(Service);
      const pricingRuleRepo = manager.getRepository(PricingRule);
      const specRepo = manager.getRepository(ServiceSpecification);

      // Get Service 
      const service = await serviceRepo.findOne({
        where: { id },
        relations: ['pricingRule', 'specifications'],
      });

      if (!service) {
        throw new NotFoundException('Service not found');
      }

      // Update Service table
      if (dto.name !== undefined) {
        service.name = dto.name;
      }

      if (dto.description !== undefined) {
        service.description = dto.description;
      }

      if (dto.isActive !== undefined) {
        service.isActive = dto.isActive;
      }

      if (files?.icon?.[0]) {
        const uploadedUrl = await this.s3Service.uploadFileHelper(
          service.id,
          'service-icon',
          files.icon,
        );

        service.iconUrl = uploadedUrl;
      }

      await serviceRepo.save(service);

      // Get Pricing Rule
      const pricingRule = await pricingRuleRepo.findOne({
        where: { serviceId: id },
      });

      if (!pricingRule) {
        throw new NotFoundException('Pricing rule not found');
      }

      // Update PricingRule table
      const pricingRuleKeys: (keyof UpdateServiceDto)[] = [
        'serviceBasePrice',
        'perHourRate',
        'perKmRate',
        'weekendMultiplier',
        'peakHourMultiplier',
        'peakHours',
        'emergencyCharge',
        'freeDistanceKm',
        'distanceChargePerKm',
        'surgeFactor',
        'isSurgeEnabled',
        'platformFee',
        'gst',
        'isServiceBasePriceApplied',
        'isGstApplied',
        'isDistanceKmApplied',
        'isWeekendApplied',
        'isPeakHourApplied',
        'isEmergencyApplied',
        'isPlatformFeeApplied',
        'isPerHourRateApplied',
      ];

      for (const key of pricingRuleKeys) {
        if (dto[key] !== undefined) {
          (pricingRule as any)[key] = dto[key];
        }
      }

      await pricingRuleRepo.save(pricingRule);

      // Update Specifications
      if (dto.specifications !== undefined && dto.specifications !== null) {
        await specRepo.delete({ serviceId: id });

        const specs = dto.specifications.map((spec) =>
          specRepo.create({
            serviceId: id,
            name: spec.name,
            type: spec.type,
            values: spec.values,
            isRequired: spec.isRequired ?? false,
            isActive: spec.isActive ?? true,
          }),
        );

        await specRepo.save(specs);
      }

      const updatedService = await serviceRepo.findOne({
        where: { id },
        relations: ['pricingRule', 'specifications'],
      });

      return {
        success: true,
        message: 'Service updated successfully',
        data: updatedService,
      };
    });
  }
  //temporarily commented
  // async updateTechnicianStatusService(
  //   technicianId: number,
  //   dto: UpdateTechnicianStatusDto,
  // ) {
  //   const technician = await this.userRepository.findOne({
  //     where: {
  //       id: technicianId,
  //       role: USER_ROLE.TECHNICIAN,
  //     },
  //     relations: ['technicianProfile'],
  //   });

  //   if (!technician) {
  //     throw new NotFoundException('Technician not found');
  //   }

  //   if (!technician.technicianProfile) {
  //     throw new BadRequestException('Technician profile not found');
  //   }

  //   if (technician.technicianProfile.status === dto.status) {
  //     throw new BadRequestException(
  //       `Technician is already ${dto.status.toLowerCase()}`,
  //     );
  //   }

  //   // Update status only if it's different
  //   technician.technicianProfile.status = dto.status;

  //   await this.technicianProfileRepository.save(
  //     technician.technicianProfile,
  //   );

  //   return {
  //     success: true,
  //     message: 'Technician status updated successfully',
  //     data: technician.technicianProfile,
  //   };
  // }
  //added
  async updateTechnicianStatusService(
    technicianId: number,
    dto: UpdateTechnicianStatusDto,
  ) {
    const technician = await this.userRepository.findOne({
      where: {
        id: technicianId,
        role: USER_ROLE.TECHNICIAN,
      },
      relations: ['technicianProfile'],
    });

    if (!technician) {
      throw new NotFoundException('Technician not found');
    }

    const profile = technician.technicianProfile;

    if (!profile) {
      throw new BadRequestException('Technician profile not found');
    }

    if (profile.status === dto.status) {
      throw new BadRequestException(
        `Technician is already ${dto.status.toLowerCase()}`,
      );
    }

    if (
      dto.status === TECHNICIAN_STATUS.PENDING_APPROVAL &&
      (
        profile.status === TECHNICIAN_STATUS.APPROVED ||
        profile.status === TECHNICIAN_STATUS.REJECTED
      )
    ) {
      throw new BadRequestException(
        'Approved or rejected technicians cannot be moved back to pending approval',
      );
    }

    const payoutAccountRepo = this.dataSource.getRepository(TechnicianPayoutAccount);
    const payoutAccount = await payoutAccountRepo.findOne({
      where: { technicianId: technician.id },
    });

    /*
     * Create Razorpay Contact and Fund Account only when:
     * 1. Admin is approving the technician
     * 2. Fund account has not already been created
     */
    if (
      dto.status === TECHNICIAN_STATUS.APPROVED &&
      (!payoutAccount || !payoutAccount.razorpayFundAccountId)
    ) {
      const hasUpi = payoutAccount && payoutAccount.upiId && payoutAccount.upiId.trim() !== '';

      if (!hasUpi) {
        if (
          !payoutAccount ||
          !payoutAccount.accountHolderName ||
          !payoutAccount.accountNumber ||
          !payoutAccount.ifscCode ||
          !payoutAccount.bankName
        ) {
          throw new BadRequestException(
            'Technician bank details or UPI ID are required before approval',
          );
        }
      }

      let contactId = payoutAccount.razorpayContactId;

      /*
       * Create Contact only when it was not created earlier.
       * This avoids duplicate Razorpay contacts if approval is retried.
       */
      if (!contactId) {
        const fullName =
          `${technician.firstName || ''} ${technician.lastName || ''
            }`.trim() || technician.username;

        if (!fullName) {
          throw new BadRequestException(
            'Technician name is required to create Razorpay contact',
          );
        }

        const contact = await this.razorpayXService.createContact({
          technicianId: technician.id,
          name: fullName,
          email: technician.email || undefined,
          phone: technician.phone || undefined,
        });

        contactId = contact.id;
        payoutAccount.razorpayContactId = contact.id;
      }

      if (!contactId) {
        throw new BadRequestException(
          'Failed to create Razorpay contact',
        );
      }

      /*
       * Create the beneficiary fund account in RazorpayX.
       * This fundAccountId will be used later during direct payout.
       */
      let fundAccount;
      if (hasUpi) {
        fundAccount = await this.razorpayXService.createVpaFundAccount({
          contactId,
          upiId: payoutAccount.upiId!,
        });
        payoutAccount.accountType = PAYOUT_ACCOUNT_TYPE.VPA;
      } else {
        fundAccount = await this.razorpayXService.createFundAccount({
          contactId,
          accountHolderName: payoutAccount.accountHolderName!,
          accountNumber: payoutAccount.accountNumber!,
          ifscCode: payoutAccount.ifscCode!,
        });
        payoutAccount.accountType = PAYOUT_ACCOUNT_TYPE.BANK_ACCOUNT;
      }

      payoutAccount.razorpayFundAccountId = fundAccount.id;
      payoutAccount.status = PAYOUT_ONBOARDING_STATUS.ACTIVE;
      payoutAccount.isActive = true;
      await payoutAccountRepo.save(payoutAccount);
    }

    // Change approval/rejection status after external setup succeeds.
    profile.status = dto.status;

    await this.technicianProfileRepository.save(profile);

    return {
      success: true,
      message: 'Technician status updated successfully',
      data: {
        id: profile.id,
        userId: profile.userId,
        status: profile.status,
        razorpayContactId: payoutAccount?.razorpayContactId,
        razorpayFundAccountId: payoutAccount?.razorpayFundAccountId,
      },
    };
  }

  async favoriteTechnician(
    user: any,
    technicianId: number,
  ) {
    const technician = await this.userRepository.findOne({
      where: {
        id: technicianId,
        role: USER_ROLE.TECHNICIAN,
      },
    });

    if (!technician) {
      throw new NotFoundException('Technician not found');
    }

    const existing =
      await this.favoriteTechnicianRepository.findFavoriteTechnician(
        user.id,
        technicianId,
      );

    if (existing) {
      await this.favoriteTechnicianRepository.removeFavoriteTechnician(
        existing,
      );

      return {
        isFavorite: false,
        message: 'Technician removed from favorites successfully',
      };
    }

    await this.favoriteTechnicianRepository.createFavoriteTechnician({
      customerId: user.id,
      technicianId,
    });

    return {
      isFavorite: true,
      message: 'Technician added to favorites successfully',
    };
  }

  async getMyAddresses(userId: number, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;
    const [addresses, total] = await this.dataSource.getRepository(CustomerAddress).findAndCount({
      where: {
        userId,
        isActive: true,
      },
      order: {
        createdAt: 'DESC',
      },
      skip,
      take: limit,
    });

    if (!addresses.length) {
      throw new NotFoundException('No addresses found');
    }

    return {
      success: true,
      message: 'Addresses fetched successfully',
      data: addresses.map(address => ({
        id: address.id,
        fullAddress: address.fullAddress,
        city: address.city,
        state: address.state,
        pincode: address.pincode,
        latitude: Number(address.latitude),
        longitude: Number(address.longitude),
        isDefault: address.isDefault,
        createdAt: address.createdAt,
        updatedAt: address.updatedAt,
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getCustomerDashboardStats(userId: number) {
    const stats =
      await this.userRepository.getCustomerDashboardStats(userId);

    return {
      success: true,
      message: 'Customer dashboard stats fetched successfully',
      data: stats,
    };
  }

  async getFavouriteTechnicians(userId: number) {
    const favourites =
      await this.favoriteTechnicianRepository.findFavouriteTechnicians(userId);

    return {
      success: true,
      message: favourites.length
        ? 'Favourite technicians fetched successfully'
        : 'No favourite technicians found',
      data: favourites.map((fav) => ({
        id: fav.technician.id,
        firstName: fav.technician.firstName,
        lastName: fav.technician.lastName,
        phone: fav.technician.phone,
        profileImage: fav.technician.profileImage,
        technicianProfile: fav.technician.technicianProfile
          ? {
            id: fav.technician.technicianProfile.id,
            status: fav.technician.technicianProfile.status,
          }
          : null,
        addedAt: fav.createdAt,
      })),
    };
  }

  async createTokenPaymentLinkService(userId: number, customCallbackUrl?: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.isTokenPaid) {
      throw new BadRequestException('Token payment has already been completed for this user');
    }

    const setting = await this.platformSettingRepository.findOne({
      where: { key: 'CUSTOMER_TOKEN_AMOUNT' },
    });
    if (!setting) {
      throw new BadRequestException('Pre-booking token amount is not configured on the platform');
    }
    const amount = parseFloat(setting.value);
    if (isNaN(amount) || amount <= 0) {
      throw new BadRequestException('Configured token amount is invalid');
    }

    const customerName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Customer';
    const paymentLink = await this.paymentService.createTokenPaymentLink(
      amount,
      user.id,
      {
        name: customerName,
        email: user.email || undefined,
        phone: user.phone || undefined,
      },
      customCallbackUrl,
    );

    // Save a new pending payment record in DB
    const paymentRepo = this.dataSource.getRepository(Payment);
    const newPayment = paymentRepo.create({
      customerId: user.id,
      payBy: USER_ROLE.CUSTOMER,
      paymentType: PAYMENT_TYPE.TOKEN_PAYMENT,
      amount,
      currency: 'INR',
      status: PAYMENT_STATUS.PENDING,
      paymentLinkId: paymentLink.paymentLinkId,
    });
    const savedPayment = await paymentRepo.save(newPayment);

    // Save payment details inside User table
    user.paymentId = savedPayment.id;
    user.isTokenPaid = false; // Reset to false when generating a new payment link
    await this.userRepository.save(user);

    return {
      success: true,
      message: 'Token payment link generated successfully',
      data: {
        paymentLinkId: paymentLink.paymentLinkId,
        paymentLink: paymentLink.url,
        paymentId: savedPayment.id,
        amount,
      },
    };
  }

  async adminCreateTechnicianService(dto: AdminCreateTechnicianDto) {
    const existingUser = await this.userRepository.findOne({
      where: [
        { phone: dto.phone },
        { username: dto.phone },
        ...(dto.email ? [{ email: dto.email }] : []),
      ],
    });
    if (existingUser) {
      throw new ConflictException('A user with this phone, email, or username already exists');
    }

    const username = dto.phone;
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const newUser = this.userRepository.create({
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
      email: dto.email,
      username,
      password: hashedPassword,
      role: USER_ROLE.TECHNICIAN,
      status: USER_STATUS.ACTIVE,
      isTechnicianProfileCompleted: false,
    });

    const savedUser = await this.userRepository.save(newUser);

    try {
      await this.smsService.sendSms(
        dto.phone,
        `Your HiChandra technician profile has been created by Admin. Please log in using your phone number (${dto.phone}) and password (${dto.password}) to complete your profile setup.`,
      );
    } catch (smsError) {
      console.error(`Failed to send technician creation SMS to ${dto.phone}:`, smsError);
    }

    const { password, ...result } = savedUser;

    return {
      success: true,
      message: 'Technician created successfully by Admin',
      data: result,
    };
  }

  async getTechniciansByServiceId(serviceId: number) {
    const service = await this.serviceRepository.findOne({
      where: { id: serviceId, isActive: true },
    });
    if (!service) {
      throw new NotFoundException('Service not found or inactive');
    }

    const techServices = await this.dataSource.getRepository(TechnicianService).find({
      where: { serviceId },
      relations: ['technicianProfile', 'technicianProfile.user'],
    });

    const payoutAccountRepo = this.dataSource.getRepository(TechnicianPayoutAccount);

    const technicians = await Promise.all(
      techServices
        .map((ts) => ts.technicianProfile)
        .filter((profile): profile is TechnicianProfile =>
          !!profile &&
          profile.status === TECHNICIAN_STATUS.APPROVED &&
          !!profile.user &&
          profile.user.status === USER_STATUS.ACTIVE
        )
        .map(async (profile) => {
          const { password, ...result } = profile.user!;

          const payoutAccount = await payoutAccountRepo.findOne({
            where: { technicianId: profile.userId },
          });

          return {
            ...result,
            technicianProfile: {
              id: profile.id,
              status: profile.status,
              yearsOfExperience: profile.yearsOfExperience,
              languages: profile.languages,
              gst: profile.gst,
              payoutAccount: payoutAccount ? {
                id: payoutAccount.id,
                upiId: payoutAccount.upiId,
                accountHolderName: payoutAccount.accountHolderName,
                bankName: payoutAccount.bankName,
                accountNumber: payoutAccount.accountNumber,
                ifscCode: payoutAccount.ifscCode,
                accountType: payoutAccount.accountType,
                status: payoutAccount.status,
                razorpayContactId: payoutAccount.razorpayContactId,
                razorpayFundAccountId: payoutAccount.razorpayFundAccountId,
              } : null,
            },
          };
        })
    );

    return {
      success: true,
      message: 'Technicians fetched successfully for this service',
      data: technicians,
    };
  }

  private maskAccountNumber(
    accountNumber: string,
  ): string {
    if (accountNumber.length <= 4) {
      return accountNumber;
    }

    return `${'*'.repeat(
      accountNumber.length - 4,
    )}${accountNumber.slice(-4)}`;
  }

  async createTechnicianPayoutAccount(
    technicianId: number,
    dto: CreateTechnicianPayoutAccountDto,
  ) {
    const technician =
      await this.userRepository.findById(
        technicianId,
      );

    if (!technician) {
      throw new NotFoundException(
        'Technician not found',
      );
    }

    if (
      technician.role !== USER_ROLE.TECHNICIAN
    ) {
      throw new ForbiddenException(
        'Only technicians can create payout accounts',
      );
    }

    const {
      accountType,
      upiId,
      accountHolderName,
      bankName,
      accountNumber,
      ifscCode,
    } = dto;

    /*
    * CREATE RAZORPAY CONTACT
    */

    const technicianName = `${technician.firstName} ${technician.lastName}`.trim();
    const contact =
      await this.razorpayXService.createContact({
        technicianId: technician.id,
        name: technicianName,
        email: technician.email,
        phone: technician.phone,
      });

    /*
    * CREATE LOCAL PAYOUT ACCOUNT
    */

    const payoutAccount =
      this.technicianPayoutAccountRepository.create({
        technicianId,
        accountType,
        razorpayContactId: contact.id,
        status:
          PAYOUT_ONBOARDING_STATUS.PENDING,
        isActive: false,
      });

    try {
      /*
      * VPA
      */

      if (
        accountType ===
        PAYOUT_ACCOUNT_TYPE.VPA
      ) {
        if (!upiId) {
          throw new BadRequestException(
            'UPI ID is required',
          );
        }

        const fundAccount =
          await this.razorpayXService
            .createVpaFundAccount({
              contactId: contact.id,
              upiId,
            });

        payoutAccount.upiId = upiId;

        payoutAccount.razorpayFundAccountId =
          fundAccount.id;
      }

      /*
      * BANK ACCOUNT
      */

      if (
        accountType ===
        PAYOUT_ACCOUNT_TYPE.BANK_ACCOUNT
      ) {
        if (
          !accountHolderName ||
          !accountNumber ||
          !ifscCode
        ) {
          throw new BadRequestException(
            'Account holder name, account number and IFSC code are required',
          );
        }

        const fundAccount =
          await this.razorpayXService.createFundAccount({
            contactId: contact.id,
            accountHolderName,
            accountNumber,
            ifscCode,
          });

        payoutAccount.accountHolderName =
          accountHolderName;

        payoutAccount.bankName = bankName;

        payoutAccount.accountNumber =
          accountNumber;

        payoutAccount.ifscCode = ifscCode;

        payoutAccount.razorpayFundAccountId =
          fundAccount.id;
      }

      payoutAccount.status =
        PAYOUT_ONBOARDING_STATUS.ACTIVE;

      payoutAccount.isActive = true;

      const savedAccount =
        await this
          .technicianPayoutAccountRepository
          .save(payoutAccount);

      return {
        id: savedAccount.id,

        technicianId:
          savedAccount.technicianId,

        accountType:
          savedAccount.accountType,

        upiId:
          savedAccount.upiId ?? null,

        accountHolderName:
          savedAccount.accountHolderName ??
          null,

        bankName:
          savedAccount.bankName ?? null,

        accountNumber:
          savedAccount.accountNumber
            ? this.maskAccountNumber(
              savedAccount.accountNumber,
            )
            : null,

        ifscCode:
          savedAccount.ifscCode ?? null,

        status:
          savedAccount.status,

        isActive:
          savedAccount.isActive,

        createdAt:
          savedAccount.createdAt,
      };
    } catch (error) {
      payoutAccount.status =
        PAYOUT_ONBOARDING_STATUS.FAILED;

      payoutAccount.isActive = false;

      await this
        .technicianPayoutAccountRepository
        .save(payoutAccount);

      throw error;
    }
  }

  async updateTechnicianPayoutAccount(
    technicianId: number,
    id: number,
    dto: UpdateTechnicianPayoutAccountDto,
  ) {
    const payoutAccount =
      await this.technicianPayoutAccountRepository.findOne({
        where: { id, technicianId },
      });

    if (!payoutAccount) {
      throw new NotFoundException(
        'Technician payout account not found',
      );
    }

    if (!payoutAccount.razorpayContactId) {
      throw new BadRequestException(
        'Razorpay contact ID not found',
      );
    }

    if (Object.keys(dto).length === 0) {
      throw new BadRequestException(
        'At least one field is required to update the payout account',
      );
    }

    const targetAccountType =
      dto.accountType ?? payoutAccount.accountType;

    if (!targetAccountType) {
      throw new BadRequestException(
        'Payout account type is required',
      );
    }

    const accountTypeChanged =
      dto.accountType !== undefined &&
      dto.accountType !== payoutAccount.accountType;

    const upiDetailsChanged =
      targetAccountType === PAYOUT_ACCOUNT_TYPE.VPA &&
      (
        accountTypeChanged ||
        (
          dto.upiId !== undefined &&
          dto.upiId !== payoutAccount.upiId
        )
      );

    const bankDetailsChanged =
      targetAccountType ===
      PAYOUT_ACCOUNT_TYPE.BANK_ACCOUNT &&
      (
        accountTypeChanged ||
        (
          dto.accountHolderName !== undefined &&
          dto.accountHolderName !==
          payoutAccount.accountHolderName
        ) ||
        (
          dto.accountNumber !== undefined &&
          dto.accountNumber !==
          payoutAccount.accountNumber
        ) ||
        (
          dto.ifscCode !== undefined &&
          dto.ifscCode !== payoutAccount.ifscCode
        )
      );

    /*
    * VPA update
    */

    if (targetAccountType === PAYOUT_ACCOUNT_TYPE.VPA) {
      const finalUpiId =
        dto.upiId ?? payoutAccount.upiId;

      if (!finalUpiId) {
        throw new BadRequestException(
          'UPI ID is required for VPA payout account',
        );
      }

      if (upiDetailsChanged) {
        payoutAccount.status =
          PAYOUT_ONBOARDING_STATUS.PENDING;

        payoutAccount.isActive = false;

        try {
          const fundAccount =
            await this.razorpayXService
              .createVpaFundAccount({
                contactId:
                  payoutAccount.razorpayContactId,
                upiId: finalUpiId,
              });

          payoutAccount.razorpayFundAccountId =
            fundAccount.id;
        } catch (error) {
          payoutAccount.status =
            PAYOUT_ONBOARDING_STATUS.FAILED;

          payoutAccount.isActive = false;

          await this.technicianPayoutAccountRepository
            .save(payoutAccount);

          throw error;
        }
      }

      payoutAccount.accountType =
        PAYOUT_ACCOUNT_TYPE.VPA;

      payoutAccount.upiId = finalUpiId;

      // Clear previous bank details.
      payoutAccount.accountHolderName = null;
      payoutAccount.bankName = null;
      payoutAccount.accountNumber = null;
      payoutAccount.ifscCode = null;
    }

    /*
    * Bank-account update
    */

    if (
      targetAccountType ===
      PAYOUT_ACCOUNT_TYPE.BANK_ACCOUNT
    ) {
      const finalAccountHolderName =
        dto.accountHolderName ??
        payoutAccount.accountHolderName;

      const finalAccountNumber =
        dto.accountNumber ??
        payoutAccount.accountNumber;

      const finalIfscCode =
        dto.ifscCode ??
        payoutAccount.ifscCode;

      if (
        !finalAccountHolderName ||
        !finalAccountNumber ||
        !finalIfscCode
      ) {
        throw new BadRequestException(
          'Account holder name, account number and IFSC code are required for a bank payout account',
        );
      }

      if (bankDetailsChanged) {
        payoutAccount.status =
          PAYOUT_ONBOARDING_STATUS.PENDING;

        payoutAccount.isActive = false;

        try {
          const fundAccount =
            await this.razorpayXService
              .createFundAccount({
                contactId:
                  payoutAccount.razorpayContactId,
                accountHolderName:
                  finalAccountHolderName,
                accountNumber:
                  finalAccountNumber,
                ifscCode: finalIfscCode,
              });

          payoutAccount.razorpayFundAccountId =
            fundAccount.id;
        } catch (error) {
          payoutAccount.status =
            PAYOUT_ONBOARDING_STATUS.FAILED;

          payoutAccount.isActive = false;

          await this.technicianPayoutAccountRepository
            .save(payoutAccount);

          throw error;
        }
      }

      payoutAccount.accountType =
        PAYOUT_ACCOUNT_TYPE.BANK_ACCOUNT;

      payoutAccount.upiId = null;

      payoutAccount.accountHolderName =
        finalAccountHolderName;

      payoutAccount.accountNumber =
        finalAccountNumber;

      payoutAccount.ifscCode =
        finalIfscCode;

      if (dto.bankName !== undefined) {
        payoutAccount.bankName = dto.bankName;
      }
    }

    payoutAccount.status =
      PAYOUT_ONBOARDING_STATUS.ACTIVE;

    payoutAccount.isActive = true;

    const updatedAccount =
      await this.technicianPayoutAccountRepository
        .save(payoutAccount);

    return {
      id: updatedAccount.id,
      technicianId: updatedAccount.technicianId,
      accountType: updatedAccount.accountType,
      upiId: updatedAccount.upiId ?? null,
      accountHolderName:
        updatedAccount.accountHolderName ?? null,
      bankName: updatedAccount.bankName ?? null,
      accountNumber:
        updatedAccount.accountNumber
          ? this.maskAccountNumber(
            updatedAccount.accountNumber,
          )
          : null,
      ifscCode: updatedAccount.ifscCode ?? null,
      status: updatedAccount.status,
      isActive: updatedAccount.isActive,
      updatedAt: updatedAccount.updatedAt,
    };
  }

  async deleteTechnicianPayoutAccount(
    technicianId: number,
    id: number,
  ) {
    const payoutAccount =
      await this.technicianPayoutAccountRepository.findOne({
        where: { id, technicianId },
      });

    if (!payoutAccount) {
      throw new NotFoundException(
        'Technician payout account not found',
      );
    }

    const count = await this.dataSource
      .getRepository(TechnicianPayoutAccount)
      .count({
        where: { technicianId },
      });

    if (count <= 1) {
      throw new BadRequestException(
        'At least one payout account must be present',
      );
    }

    await this.technicianPayoutAccountRepository.delete(id);

    return {
      id,
      deleted: true,
    };
  }

  async getAdminDashboardStats() {
    const paymentRepo = this.dataSource.getRepository(Payment);

    // 1. Total revenue: sum of payment.amount where status = SUCCESS and paymentType = BOOKING_PAYMENT
    const totalRevenueRes = await paymentRepo
      .createQueryBuilder('payment')
      .select('SUM(payment.amount)', 'sum')
      .where('payment.status = :status', { status: PAYMENT_STATUS.SUCCESS })
      .andWhere('payment.paymentType = :type', { type: PAYMENT_TYPE.BOOKING_PAYMENT })
      .getRawOne();
    const totalRevenue = parseFloat(totalRevenueRes?.sum || '0');

    // 2. Total technician payout: sum of payment.amount where status = SUCCESS and paymentType = TECHNICIAN_PAYOUT
    const totalTechnicianPayoutRes = await paymentRepo
      .createQueryBuilder('payment')
      .select('SUM(payment.amount)', 'sum')
      .where('payment.status = :status', { status: PAYMENT_STATUS.SUCCESS })
      .andWhere('payment.paymentType = :type', { type: PAYMENT_TYPE.TECHNICIAN_PAYOUT })
      .getRawOne();
    const totalTechnicianPayout = parseFloat(totalTechnicianPayoutRes?.sum || '0');

    // 2.1 Total customer refund: sum of payment.amount where status = SUCCESS and paymentType = CUSTOMER_REFUND
    const totalCustomerRefundRes = await paymentRepo
      .createQueryBuilder('payment')
      .select('SUM(payment.amount)', 'sum')
      .where('payment.status = :status', { status: PAYMENT_STATUS.SUCCESS })
      .andWhere('payment.paymentType = :type', { type: PAYMENT_TYPE.CUSTOMER_REFUND })
      .getRawOne();
    const totalCustomerRefund = parseFloat(totalCustomerRefundRes?.sum || '0');

    // 3. Total number of transaction success and pending
    const successTransactionCount = await paymentRepo.count({
      where: { status: PAYMENT_STATUS.SUCCESS },
    });
    const pendingTransactionCount = await paymentRepo.count({
      where: { status: PAYMENT_STATUS.PENDING },
    });

    // 4. Total number of transactions with success TECHNICIAN_PAYOUT, BOOKING_PAYMENT, and CUSTOMER_REFUND
    const successTechnicianPayoutCount = await paymentRepo.count({
      where: {
        status: PAYMENT_STATUS.SUCCESS,
        paymentType: PAYMENT_TYPE.TECHNICIAN_PAYOUT,
      },
    });
    const successBookingPaymentCount = await paymentRepo.count({
      where: {
        status: PAYMENT_STATUS.SUCCESS,
        paymentType: PAYMENT_TYPE.BOOKING_PAYMENT,
      },
    });
    const successCustomerRefundCount = await paymentRepo.count({
      where: {
        status: PAYMENT_STATUS.SUCCESS,
        paymentType: PAYMENT_TYPE.CUSTOMER_REFUND,
      },
    });

    const successPayoutAndBookingCount = successTechnicianPayoutCount + successBookingPaymentCount;

    return {
      totalRevenue,
      totalTechnicianPayout,
      totalCustomerRefund,
      successTransactionCount,
      pendingTransactionCount,
      successTechnicianPayoutCount,
      successBookingPaymentCount,
      successCustomerRefundCount,
      successPayoutAndBookingCount,
    };
  }

  async scramblePhoneNumbers(phones?: string[]) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('Scramble phone cron skipped because environment is production');
      return;
    }
    console.log("Scramble phone cron is running");
    const targetPhones = phones && phones.length > 0 ? phones : [
      // '8923101766',
      '9817361209',
      '7082354083',
      // '7668697182',
      '9354678205',
    ];

    const userRepo = this.dataSource.getRepository(User);

    for (const originalPhone of targetPhones) {
      const user = await userRepo.findOne({
        where: { phone: originalPhone }
      });

      if (user) {
        let newPhone = '';
        let isAlreadyUsed = true;

        while (isAlreadyUsed) {
          newPhone = this.generateRandomPhoneNumber();
          const existing = await userRepo.findOne({
            where: { phone: newPhone }
          });
          if (!existing) {
            isAlreadyUsed = false;
          }
        }

        user.phone = newPhone;
        if (user.username === originalPhone) {
          user.username = newPhone;
        }

        await userRepo.save(user);
        console.log(`Successfully scrambled phone ${originalPhone} -> ${newPhone} for user ID ${user.id}`);
      }
    }
  }

  private generateRandomPhoneNumber(): string {
    const prefixes = ['9', '8', '7', '6'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    let rest = '';
    for (let i = 0; i < 9; i++) {
      rest += Math.floor(Math.random() * 10);
    }
    return prefix + rest;
  }

  private roundCurrency(amount: number,): number {
    return Math.round((amount + Number.EPSILON) * 100,) / 100;
  }

  async getTechnicianDashboardStats(
    technicianId: number,
  ): Promise<{
    availableJobs: number;
    activeJobs: number;
    todayEarning: number;
    walletBalance: number;
    currency: 'INR';
  }> {
    if (!Number.isInteger(technicianId) || technicianId <= 0) {
      throw new BadRequestException('Invalid technician ID',);
    }

    const technician =
      await this.userRepository.findOne({
        where: {
          id: technicianId,
          role: USER_ROLE.TECHNICIAN,
          status: USER_STATUS.ACTIVE,
        },
        relations: [
          'technicianProfile',
        ],
      });
    if (!technician) {
      throw new NotFoundException('Active technician not found',);
    }
    if (!technician.technicianProfile) {
      throw new BadRequestException('Technician profile not found',);
    }
    if (technician.technicianProfile.status !== TECHNICIAN_STATUS.APPROVED) {
      throw new ForbiddenException('Only approved technicians can access dashboard stats',);
    }

    const bookingStats =
      await this.bookingRepository.getTechnicianDashboardBookingStats(technicianId,);

    return {
      availableJobs: bookingStats.availableJobs,
      activeJobs: bookingStats.activeJobs,
      todayEarning: this.roundCurrency(bookingStats.todayEarning,),
      walletBalance: this.roundCurrency(bookingStats.totalEarning,),
      currency: 'INR',
    };
  }

  async updateTechnicianServices(
    userId: number,
    dto: UpdateTechnicianServicesDto,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      const profileRepo = manager.getRepository(TechnicianProfile);
      const techServiceRepo = manager.getRepository(TechnicianService);
      const serviceRepo = manager.getRepository(Service);

      const user = await userRepo.findOne({
        where: { id: userId },
        relations: ['technicianProfile'],
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (user.role !== USER_ROLE.TECHNICIAN) {
        throw new BadRequestException('Only technicians can manage services');
      }

      let profile = user.technicianProfile;
      if (!profile) {
        profile = profileRepo.create({
          userId: user.id,
          status: TECHNICIAN_STATUS.PENDING_APPROVAL,
        });
        profile = await profileRepo.save(profile);
      }

      // Delete existing technician services
      await techServiceRepo.delete({ technicianProfileId: profile.id });

      // Save new services if provided
      if (dto.services && dto.services.length > 0) {
        const uniqueIds = Array.from(new Set(dto.services));
        for (const sId of uniqueIds) {
          const sExists = await serviceRepo.findOne({
            where: { id: sId, isActive: true },
          });
          if (!sExists) {
            throw new BadRequestException(
              `Service with ID ${sId} does not exist or is inactive`,
            );
          }
        }

        const servicesToSave = uniqueIds.map((serviceId) =>
          techServiceRepo.create({
            technicianProfileId: profile.id,
            serviceId,
          }),
        );
        await techServiceRepo.save(servicesToSave);
      }

      return {
        success: true,
        message: 'Technician services updated successfully',
      };
    });
  }

  async createTechnicianLocation(
    userId: number,
    dto: CreateTechnicianLocationDto,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      const profileRepo = manager.getRepository(TechnicianProfile);
      const locationRepo = manager.getRepository(TechnicianLocation);

      const user = await userRepo.findOne({
        where: { id: userId },
        relations: ['technicianProfile'],
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (user.role !== USER_ROLE.TECHNICIAN) {
        throw new BadRequestException('Only technicians can add locations');
      }

      let profile = user.technicianProfile;
      if (!profile) {
        profile = profileRepo.create({
          userId: user.id,
          status: TECHNICIAN_STATUS.PENDING_APPROVAL,
        });
        profile = await profileRepo.save(profile);
      }

      const isDefault = dto.isDefault === true;

      if (isDefault) {
        // Reset all other locations for this profile to false
        await locationRepo.update(
          { technicianId: profile.id },
          { isDefault: false },
        );
      }

      const newLocation = locationRepo.create({
        technicianId: profile.id,
        latitude: dto.latitude,
        longitude: dto.longitude,
        serviceRadiusKm: dto.serviceRadiusKm,
        fullAddress: dto.fullAddress,
        city: dto.city,
        state: dto.state,
        pincode: dto.pincode,
        isDefault,
        isActive: dto.isActive !== false,
        currentLat: dto.latitude,
        currentLng: dto.longitude,
        locationUpdatedAt: new Date(),
      });

      const savedLocation = await locationRepo.save(newLocation);

      return {
        success: true,
        message: 'Technician location created successfully',
        data: savedLocation,
      };
    });
  }

  async updateTechnicianLocation(
    userId: number,
    id: number,
    dto: UpdateTechnicianLocationDto,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      const locationRepo = manager.getRepository(TechnicianLocation);

      const user = await userRepo.findOne({
        where: { id: userId },
        relations: ['technicianProfile'],
      });

      if (!user || !user.technicianProfile) {
        throw new NotFoundException('Technician profile not found');
      }

      const technicianProfileId = user.technicianProfile.id;

      const location = await locationRepo.findOne({
        where: { id, technicianId: technicianProfileId },
      });

      if (!location) {
        throw new NotFoundException('Technician location not found');
      }

      if (dto.latitude !== undefined) {
        location.latitude = dto.latitude;
        location.currentLat = dto.latitude;
        location.locationUpdatedAt = new Date();
      }
      if (dto.longitude !== undefined) {
        location.longitude = dto.longitude;
        location.currentLng = dto.longitude;
        location.locationUpdatedAt = new Date();
      }
      if (dto.serviceRadiusKm !== undefined) {
        location.serviceRadiusKm = dto.serviceRadiusKm;
      }
      if (dto.fullAddress !== undefined) {
        location.fullAddress = dto.fullAddress;
      }
      if (dto.city !== undefined) {
        location.city = dto.city;
      }
      if (dto.state !== undefined) {
        location.state = dto.state;
      }
      if (dto.pincode !== undefined) {
        location.pincode = dto.pincode;
      }
      if (dto.isActive !== undefined) {
        location.isActive = dto.isActive;
      }

      if (dto.isDefault === true) {
        // Set all other locations for this technician to isDefault = false
        await locationRepo.update(
          { technicianId: technicianProfileId },
          { isDefault: false },
        );
        location.isDefault = true;
      } else if (dto.isDefault === false) {
        location.isDefault = false;
      }

      const savedLocation = await locationRepo.save(location);

      return {
        success: true,
        message: 'Technician location updated successfully',
        data: savedLocation,
      };
    });
  }

  async deleteTechnicianLocation(
    userId: number,
    id: number,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      const locationRepo = manager.getRepository(TechnicianLocation);

      const user = await userRepo.findOne({
        where: { id: userId },
        relations: ['technicianProfile'],
      });

      if (!user || !user.technicianProfile) {
        throw new NotFoundException('Technician profile not found');
      }

      const technicianProfileId = user.technicianProfile.id;

      const location = await locationRepo.findOne({
        where: { id, technicianId: technicianProfileId },
      });

      if (!location) {
        throw new NotFoundException('Technician location not found');
      }

      await locationRepo.delete(id);

      return {
        success: true,
        message: 'Technician location deleted successfully',
      };
    });
  }

  async updateTechnicianBrandExpertise(
    userId: number,
    dto: UpdateTechnicianBrandExpertiseDto,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      const profileRepo = manager.getRepository(TechnicianProfile);
      const brandRepo = manager.getRepository(TechnicianBrandExpertise);

      const user = await userRepo.findOne({
        where: { id: userId },
        relations: ['technicianProfile'],
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (user.role !== USER_ROLE.TECHNICIAN) {
        throw new BadRequestException('Only technicians can manage brand expertise');
      }

      let profile = user.technicianProfile;
      if (!profile) {
        profile = profileRepo.create({
          userId: user.id,
          status: TECHNICIAN_STATUS.PENDING_APPROVAL,
        });
        profile = await profileRepo.save(profile);
      }

      // Delete existing brand expertise records
      await brandRepo.delete({ technicianProfileId: profile.id });

      // Save new brands if provided
      if (dto.brands && dto.brands.length > 0) {
        const uniqueBrands = Array.from(new Set(dto.brands));
        const brandsToSave = uniqueBrands.map((brandName) =>
          brandRepo.create({
            technicianProfileId: profile.id,
            brandName,
          }),
        );
        await brandRepo.save(brandsToSave);
      }

      return {
        success: true,
        message: 'Technician brand expertise updated successfully',
      };
    });
  }
}
