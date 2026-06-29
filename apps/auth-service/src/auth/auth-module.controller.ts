import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { AuthModuleService } from './auth-module.service';
import { JwtAuthGuard } from '@hichandra/common';
import { LoginDto, RegisterUserDto, VerifyOtpDto, ResetPasswordDto, ForgotPasswordDto} from '@hichandra/dtos';

@Controller('auth')
export class AuthModuleController {
  constructor(private readonly authModuleService: AuthModuleService) {}

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: any) {
    return this.authModuleService.logoutService(req.user.id);
  }

  @Post('generate-otp')
  @HttpCode(HttpStatus.OK)
  async generateOtp(
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: RegisterUserDto,
  ) {
    return this.authModuleService.generateOtpService(dto);
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: VerifyOtpDto,
  ) {
    return this.authModuleService.verifyOtpService(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Req() req: any,
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: LoginDto,
  ) {
    return this.authModuleService.loginService(dto);
  }

  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  async refreshToken(@Body('refreshToken') refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token missing');
    }

    return this.authModuleService.refreshToken(refreshToken);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getProfile(@Req() req: any) {
    return this.authModuleService.getProfileService(
      req.user.sub || req.user.id,
    );
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(
    @Body(new ValidationPipe({ whitelist: true, transform: true })) dto: ForgotPasswordDto,
  ) {
    return this.authModuleService.forgotPasswordService(dto);
  }

  @Patch('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body(new ValidationPipe({ whitelist: true, transform: true })) dto: ResetPasswordDto,
  ) {
    return this.authModuleService.resetPasswordService(dto);
  }

  // @Get('profile')
  // @UseGuards(JwtAuthGuard)
  // getProfile(@Req() req: any) {
  //   return {
  //     message: 'Authorized',
  //     user: req.user,
  //   };
  // }

  // @Patch('change-password')
  // @UseGuards(JwtAuthGuard)
  // async changePassword(
  //   @Req() req: any,
  //   @Body(new ValidationPipe({ whitelist: true, transform: true })) dto: ChangePasswordDto,
  // ) {
  //   return this.authModuleService.changePasswordService(req.user.id, dto);
  // }
}
