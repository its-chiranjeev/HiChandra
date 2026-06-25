import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnprocessableEntityException,
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
} from '@hichandra/dtos';

@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly otpRepository: OtpRepository,
    private readonly serviceRepository: ServiceRepository,
    private readonly platformSettingRepository: PlatformSettingRepository,
    private readonly technicianProfileRepository: TechnicianProfileRepository,
    private readonly dataSource: DataSource,
    private readonly authModuleService: AuthModuleService,
    private readonly s3Service: S3Service,
    @InjectRepository(PricingRule)
    private readonly pricingRuleRepository: Repository<PricingRule>,
  ) {}

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

  async getAllUsersService(
    page: number,
    limit: number,
    role?: USER_ROLE,
    status?: USER_STATUS,
  ) {
    const { users, total } = await this.userRepository.findAllUsers(
      page,
      limit,
      role,
      status,
    );
    const formattedUsers = users.map((user) => {
      const {
        password,
        hashedRefreshToken,
        tokenVersion,
        technicianProfileId,
        technicianProfile,
        addresses,
        ...safeUser

      } = user;

      if (user.role === USER_ROLE.CUSTOMER) {
        return {
          ...safeUser,
          addresses: addresses || [],
        };
      }

      if (user.role === USER_ROLE.TECHNICIAN) {
        return {
          ...safeUser,
          technicianProfileId,
          technicianProfile,
        };
      }

      return safeUser;
    });
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
    const user = await this.userRepository.findById(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { password, hashedRefreshToken, tokenVersion, ...safeUser } = user;

    return {
      success: true,
      message: 'User fetched successfully',
      data: safeUser,
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

  async getAllServices(page?: number, limit?: number) {
    const { services, total } = await this.serviceRepository.findAllServices(
      page,
      limit,
    );

    const formattedServices = await Promise.all(
      services.map(async (service) => {
        let iconDownloadUrl;
        if (service.iconUrl) {
          // Generate download URL here
          iconDownloadUrl = await this.s3Service.getDownloadUrl(
            service.iconUrl,
          );
        }
        const serviceData = {
          ...service,
          iconDownloadUrl,
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

    const serviceData = {
      ...service,
    };

    (serviceData as any).iconDownloadUrl = undefined;
    if (service.iconUrl) {
      // Generate download URL here
      (serviceData as any).iconDownloadUrl =
        await this.s3Service.getDownloadUrl(service.iconUrl);
    }

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
    if (!dto.email) {
      throw new BadRequestException('Email is required');
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

      const existingUser = await userRepository.findOne({
        where: { email: dto.email },
      });
      if (existingUser) {
        throw new ConflictException('Email already in use');
      }

      if (dto.username) {
        const existingUserByUsername = await userRepository.findOne({
          where: { username: dto.username },
        });
        if (existingUserByUsername) {
          throw new ConflictException('Username already in use');
        }
      }

      const existingUserByPhone = await userRepository.findOne({
        where: { phone: dto.phone },
      });
      if (existingUserByPhone) {
        throw new ConflictException('Phone number already in use');
      }

      const otpRecord = await otpRepository.findOne({
        where: { email: dto.email, phone: dto.phone },
      });

      if (!otpRecord) {
        throw new BadRequestException(
          'OTP record not found for this email and phone',
        );
      }

      if (!otpRecord.isVerified) {
        throw new ForbiddenException('OTP is not verified');
      }

      await otpRepository.delete(otpRecord.id);

      const hashedPassword = await bcrypt.hash(dto.password, 10);

      const newUser = userRepository.create({
        email: dto.email,
        username: dto.username,
        phone: dto.phone,
        firstName: dto.firstName,
        lastName: dto.lastName,
        password: hashedPassword,
        role: otpRecord.role || USER_ROLE.CUSTOMER,
        status:
          otpRecord.role === USER_ROLE.TECHNICIAN
            ? USER_STATUS.PENDING
            : USER_STATUS.ACTIVE,
      });

      let savedUser = await userRepository.save(newUser);

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
          hasLadder: profileData.hasLadder || false,
          hasACGauges: profileData.hasACGauges || false,
          hasSafetyEquipment: profileData.hasSafetyEquipment || false,
          hasVehicle: profileData.hasVehicle || false,
          accountHolderName: profileData.accountHolderName || '',
          accountNumber: profileData.accountNumber || '',
          ifscCode: profileData.ifscCode || '',
          bankName: profileData.bankName || '',
        });
        const savedProfile = await technicianProfileRepository.save(newProfile);

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
        serviceBasePrice: dto.serviceBasePrice,
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

      const hasTechFields =
        dto.technicianProfile ||
        dto.location ||
        dto.services ||
        dto.brandExpertise;
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
          if (profileData.hasLadder !== undefined)
            profile.hasLadder = profileData.hasLadder;
          if (profileData.hasACGauges !== undefined)
            profile.hasACGauges = profileData.hasACGauges;
          if (profileData.hasSafetyEquipment !== undefined)
            profile.hasSafetyEquipment = profileData.hasSafetyEquipment;
          if (profileData.hasVehicle !== undefined)
            profile.hasVehicle = profileData.hasVehicle;
          if (profileData.accountHolderName !== undefined)
            profile.accountHolderName = profileData.accountHolderName;
          if (profileData.accountNumber !== undefined)
            profile.accountNumber = profileData.accountNumber;
          if (profileData.ifscCode !== undefined)
            profile.ifscCode = profileData.ifscCode;
          if (profileData.bankName !== undefined)
            profile.bankName = profileData.bankName;

          await profileRepo.save(profile);
        }

        if (dto.location) {
          const locData = dto.location;
          let location = await locationRepo.findOne({
            where: { technicianId: profile.id },
          });

          if (!location) {
            location = locationRepo.create({
              technicianId: profile.id,
              latitude: locData.latitude ?? 0,
              longitude: locData.longitude ?? 0,
              currentLat: locData.latitude ?? 0,
              currentLng: locData.longitude ?? 0,
              locationUpdatedAt: new Date(),
              isActive: true,
            });
          }

          if (locData.latitude !== undefined) {
            location.latitude = locData.latitude;
            location.currentLat = locData.latitude;
            location.locationUpdatedAt = new Date();
          }
          if (locData.longitude !== undefined) {
            location.longitude = locData.longitude;
            location.currentLng = locData.longitude;
            location.locationUpdatedAt = new Date();
          }
          if (locData.fullAddress !== undefined)
            location.fullAddress = locData.fullAddress;
          if (locData.city !== undefined) location.city = locData.city;
          if (locData.state !== undefined) location.state = locData.state;
          if (locData.pincode !== undefined) location.pincode = locData.pincode;
          if (locData.serviceRadiusKm !== undefined)
            location.serviceRadiusKm = locData.serviceRadiusKm;

          await locationRepo.save(location);
        }

        if (dto.services) {
          await techServiceRepo.delete({ technicianProfileId: profile.id });

          if (dto.services.length > 0) {
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
        }

        if (dto.brandExpertise) {
          await brandRepo.delete({ technicianProfileId: profile.id });

          if (dto.brandExpertise.length > 0) {
            const uniqueBrands = Array.from(new Set(dto.brandExpertise));
            const brandsToSave = uniqueBrands.map((brandName) =>
              brandRepo.create({
                technicianProfileId: profile.id,
                brandName,
              }),
            );
            await brandRepo.save(brandsToSave);
          }
        }
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
      if (dto.serviceBasePrice !== undefined) {
        pricingRule.serviceBasePrice = dto.serviceBasePrice;
      }

      if (dto.perHourRate !== undefined) {
        pricingRule.perHourRate = dto.perHourRate;
      }

      if (dto.perKmRate !== undefined) {
        pricingRule.perKmRate = dto.perKmRate;
      }

      if (dto.weekendMultiplier !== undefined) {
        pricingRule.weekendMultiplier = dto.weekendMultiplier;
      }

      if (dto.peakHourMultiplier !== undefined) {
        pricingRule.peakHourMultiplier = dto.peakHourMultiplier;
      }

      if (dto.peakHours !== undefined) {
        pricingRule.peakHours = dto.peakHours;
      }

      if (dto.emergencyCharge !== undefined) {
        pricingRule.emergencyCharge = dto.emergencyCharge;
      }

      if (dto.freeDistanceKm !== undefined) {
        pricingRule.freeDistanceKm = dto.freeDistanceKm;
      }

      if (dto.distanceChargePerKm !== undefined) {
        pricingRule.distanceChargePerKm = dto.distanceChargePerKm;
      }

      if (dto.surgeFactor !== undefined) {
        pricingRule.surgeFactor = dto.surgeFactor;
      }

      if (dto.isSurgeEnabled !== undefined) {
        pricingRule.isSurgeEnabled = dto.isSurgeEnabled;
      }

      if (dto.platformFee !== undefined) {
        pricingRule.platformFee = dto.platformFee;
      }

      if (dto.gst !== undefined) {
        pricingRule.gst = dto.gst;
      }

      await pricingRuleRepo.save(pricingRule);

      // Update Specifications
      if (dto.specifications) {
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
}
