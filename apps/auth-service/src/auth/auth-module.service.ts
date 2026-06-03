import {
  ConflictException,
  BadRequestException,
  InternalServerErrorException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { UserRepository } from '@hichandra/repositories';
import * as bcrypt from 'bcryptjs';
import { User, USER_STATUS } from '@hichandra/entities';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { LoginDto, RegisterDto } from '@hichandra/dtos';
import { DataSource } from 'typeorm';

@Injectable()
export class AuthModuleService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
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
    });

    const savedUser = await this.userRepository.save(newUser);

    const data = await this.issueAuthTokens(savedUser);

    return {
      message: 'Registration successful',
      ...data,
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
