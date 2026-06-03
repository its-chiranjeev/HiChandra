import {
  ConflictException,
  BadRequestException,
  InternalServerErrorException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { UserRepository, OtpRepository } from '@hichandra/repositories';
import * as bcrypt from 'bcryptjs';
import { User, USER_STATUS, USER_ROLE } from '@hichandra/entities';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { LoginDto, RegisterDto, RegisterUserDto, VerifyOtpDto } from '@hichandra/dtos';
import { DataSource } from 'typeorm';
import { EmailService } from '@hichandra/email-services';

@Injectable()
export class AuthModuleService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly otpRepository: OtpRepository,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService
  ) { }

  private async issueAuthTokens(user: User) {
    const accessSecret =
      this.configService.get<string>('JWT_ACCESS_SECRET') ||
      this.configService.get<string>('JWT_SECRET');

    const refreshSecret =
      this.configService.get<string>('JWT_REFRESH_SECRET') ||
      this.configService.get<string>('JWT_SECRET');

    if (!accessSecret || !refreshSecret) {
      throw new InternalServerErrorException('JWT secret not configured');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion,
    };

    const accessToken = this.signJwt(payload, accessSecret, 2 * 24 * 60 * 60);
    const refreshToken = this.signJwt(payload, refreshSecret, 7 * 24 * 60 * 60);
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);

    await this.userRepository.update(user.id, {
      lastLoginAt: new Date(),
      hashedRefreshToken,
    });

    return {
      tokens: {
        accessToken,
        refreshToken,
      },
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }

  private signJwt(
    payload: Record<string, unknown>,
    secret: string,
    expiresInSeconds: number,
  ): string {
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'HS256', typ: 'JWT' };
    const body = {
      ...payload,
      iat: now,
      exp: now + expiresInSeconds,
    };

    const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
    const encodedBody = this.base64UrlEncode(JSON.stringify(body));
    const data = `${encodedHeader}.${encodedBody}`;

    const signature = createHmac('sha256', secret)
      .update(data)
      .digest('base64url');

    return `${data}.${signature}`;
  }

  private base64UrlEncode(value: string): string {
    return Buffer.from(value).toString('base64url');
  }

  async registerService(dto: RegisterDto) {
    const existingUser = await this.userRepository.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException('Email already in use');
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

    const data = await this.issueAuthTokens(savedUser);

    return {
      message: 'Registration successful',
      ...data,
    };
  }

  async registerUserService(dto: RegisterUserDto) {
    if (!dto.email && !dto.phone) {
      throw new BadRequestException('At least email or phone number must be provided');
    }

    // 1. Verify if user already exists by email
    if (dto.email) {
      const existingUserByEmail = await this.userRepository.findByEmail(dto.email);
      if (existingUserByEmail) {
        throw new ConflictException('Email already in use');
      }
      const verifyAccount = await this.otpRepository.findOne({ where: { email: dto.email } });
      if (verifyAccount) {
        await this.otpRepository.delete(verifyAccount.id);
      }
    }

    // 2. Verify if user already exists by phone
    if (dto.phone) {
      const existingUserByPhone = await this.userRepository.findOne({
        where: { phone: dto.phone },
      });
      if (existingUserByPhone) {
        throw new ConflictException('Phone number already in use');
      }
      const verifyAccount = await this.otpRepository.findOne({ where: { phone: dto.phone } });
      if (verifyAccount) {
        await this.otpRepository.delete(verifyAccount.id);
      }
    }

    // 5. Generate a 6-digit numeric OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // 6. Save OTP to database
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10); // OTP expires in 10 minutes

    const newOtp = this.otpRepository.create({
      ...(dto.email && { email: dto.email }),
      ...(dto.phone && { phone: dto.phone }),
      otp: otpCode,
      expiresAt,
      isUsed: false,
    });
    await this.otpRepository.save(newOtp);

    // 7. Send one email with email and otp (for now commented out)
    if (dto.email) {
      await this.emailService.sendOtpEmail(dto.email, otpCode);
    }

    return {
      message: 'OTP has been sent.',
      email: dto.email,
      phone: dto.phone,
    };
  }

  async verifyOtpService(dto: VerifyOtpDto) {
    // 1. Only allow customer and technician roles
    if (dto.role !== USER_ROLE.CUSTOMER && dto.role !== USER_ROLE.TECHNICIAN) {
      throw new ForbiddenException('Only customer and technician roles can verify OTP via this endpoint');
    }

    // 2. Check if verified email is in the table with the matching OTP code
    const otpRecord = await this.otpRepository.findOne({
      where: {
        email: dto.email,
        otp: dto.otp,
        isUsed: false,
      },
    });

    if (!otpRecord) {
      throw new BadRequestException('Invalid OTP code or email');
    }

    // 3. Check expiration time
    if (otpRecord.expiresAt < new Date()) {
      throw new BadRequestException('OTP has expired');
    }

    // 4. Delete the OTP entry
    await this.otpRepository.delete(otpRecord.id);

    // 5. Verify that the email, username, and phone are unique before saving
    const existingUserByEmail = await this.userRepository.findByEmail(dto.email);
    if (existingUserByEmail) {
      throw new ConflictException('Email already in use');
    }

    const existingUserByUsername = await this.userRepository.findOne({
      where: { username: dto.username },
    });
    if (existingUserByUsername) {
      throw new ConflictException('Username already in use');
    }

    if (dto.phone) {
      const existingUserByPhone = await this.userRepository.findOne({
        where: { phone: dto.phone },
      });
      if (existingUserByPhone) {
        throw new ConflictException('Phone number already in use');
      }
    }

    // 6. Store the user data in user entity
    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const newUser = this.userRepository.create({
      email: dto.email,
      phone: dto.phone,
      username: dto.username,
      firstName: dto.firstName,
      lastName: dto.lastName,
      password: hashedPassword,
      role: dto.role,
      status: USER_STATUS.ACTIVE,
    });

    const savedUser = await this.userRepository.save(newUser);

    // 7. Issue auth tokens and return user data
    const tokenData = await this.issueAuthTokens(savedUser);

    return {
      message: 'OTP verified successfully. User registered.',
      ...tokenData,
    };
  }

  // async registerService(dto: RegisterDto) {
  //   const existingUser = await this.userRepository.findByEmail(dto.email);
  //   if (existingUser) {
  //     throw new ConflictException('Email already in use');
  //   }

  //   const hashedPassword = await bcrypt.hash(dto.password, 10);

  //   const newUser = this.userRepository.create({
  //     email: dto.email,
  //     username: dto.username,
  //     ...(dto.phone && { phone: dto.phone }),
  //     firstName: dto.firstName,
  //     lastName: dto.lastName,
  //     password: hashedPassword,
  //   });

  //   const savedUser = await this.userRepository.save(newUser);

  //   const data = await this.issueAuthTokens(savedUser);

  //   return {
  //     message: 'Registration successful',
  //     ...data,
  //   };
  // }

  async loginService(dto: LoginDto) {
    const user = await this.userRepository.findByEmailOrUsername(dto.email);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const passwordMatch = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (
      user.status === USER_STATUS.BLOCKED ||
      user.status === USER_STATUS.INACTIVE
    ) {
      throw new ForbiddenException('User is blocked');
    }

    const data = await this.issueAuthTokens(user);
    return {
      message: 'Login successful',
      ...data,
    };
  }

  // async refreshToken(refreshToken: string) {
  //   try {
  //     // 1. Verify refresh token signature
  //     const payload = this.jwtServic.verify(refreshToken, {
  //       secret:
  //         this.configService.get<string>('JWT_REFRESH_SECRET') ||
  //         this.configService.get<string>('JWT_SECRET'),
  //     });

  //     // 2. Find user
  //     const user = await this.userRepository.findOne({
  //       where: { id: payload.sub },
  //     });

  //     if (!user) {
  //       throw new UnauthorizedException('User not found');
  //     }

  //     // 3. Compare refresh token with DB hash
  //     const isValid = await bcrypt.compare(
  //       refreshToken,
  //       user.hashedRefreshToken,
  //     );

  //     if (!isValid) {
  //       throw new UnauthorizedException('Invalid refresh token');
  //     }

  //     // 4. Optional security check
  //     if (user.status !== USER_STATUS.ACTIVE) {
  //       throw new ForbiddenException('User is not active');
  //     }

  //     // 5. Create new access token
  //     const newAccessToken = this.jwtService.sign(
  //       {
  //         sub: user.id,
  //         email: user.email,
  //         role: user.role,
  //         tokenVersion: user.tokenVersion,
  //       },
  //       {
  //         secret:
  //           this.configService.get<string>('JWT_ACCESS_SECRET') ||
  //           this.configService.get<string>('JWT_SECRET'),
  //         expiresIn: '15m',
  //       },
  //     );

  //     // 6. (BEST PRACTICE) rotate refresh token
  //     const newRefreshToken = this.jwtService.sign(
  //       {
  //         sub: user.id,
  //         email: user.email,
  //         role: user.role,
  //         tokenVersion: user.tokenVersion,
  //       },
  //       {
  //         secret:
  //           this.configService.get<string>('JWT_REFRESH_SECRET') ||
  //           this.configService.get<string>('JWT_SECRET'),
  //         expiresIn: '7d',
  //       },
  //     );

  //     const hashedRefreshToken = await bcrypt.hash(newRefreshToken, 10);

  //     await this.userRepository.update(user.id, {
  //       hashedRefreshToken,
  //     });

  //     // 7. Return tokens
  //     return {
  //       accessToken: newAccessToken,
  //       refreshToken: newRefreshToken,
  //     };
  //   } catch (e) {
  //     throw new UnauthorizedException('Invalid refresh token');
  //   }
  // }
}
