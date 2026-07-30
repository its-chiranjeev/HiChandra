import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { Body, Controller, Query, Get, Put, Patch, Delete, Param, ParseIntPipe, HttpCode, HttpStatus, Post, Req, UnauthorizedException, UseGuards, UseInterceptors, ValidationPipe, UploadedFiles, UnprocessableEntityException, BadRequestException, } from '@nestjs/common';
import { UserService } from './user.service';
import * as jwt from 'jsonwebtoken';
import { AuthGuard } from '@nestjs/passport';
import { JwtAuthGuard, Roles, RolesGuard } from '@hichandra/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  RegisterDto,
  UpdateUserDto,
  CreateServiceDto,
  CreatePlatformSettingDto,
  CustomerAddressDto,
  UpdateCustomerAddressDto,
  UpdateProfileDto,
  AssignBookingDto,
  UpdateTechnicianStatusDto,
  AdminCreateTechnicianDto,
  CreateTechnicianPayoutAccountDto,
  UpdateTechnicianPayoutAccountDto,
  UpdateTechnicianServicesDto,
  UpdateTechnicianLocationDto,
  UpdateTechnicianBrandExpertiseDto,
  CreateTechnicianLocationDto
} from '@hichandra/dtos';
import { TECHNICIAN_STATUS, USER_ROLE, USER_STATUS } from '@hichandra/entities';
import { UpdateServiceDto } from '@hichandra/dtos';
import { filter } from 'rxjs';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) { }

  @Post('admin/service')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(USER_ROLE.ADMIN)
  @UseInterceptors(FileFieldsInterceptor([{ name: 'icon', maxCount: 1 }]))
  @HttpCode(HttpStatus.OK)
  async createService(
    @UploadedFiles()
    files: {
      icon?: Express.Multer.File[];
    },
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: CreateServiceDto,
  ) {
    return this.userService.createServiceWithPricing(dto, files);
  }

  @Post('admin/technician')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(USER_ROLE.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async adminCreateTechnician(
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: AdminCreateTechnicianDto,
  ) {
    return this.userService.adminCreateTechnicianService(dto);
  }

  @Delete('delete/service/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(USER_ROLE.ADMIN)
  @HttpCode(HttpStatus.OK)
  async deleteService(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.userService.deleteService(id);
  }

  @Post('admin/platform-setting')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(USER_ROLE.ADMIN)
  @HttpCode(HttpStatus.OK)
  async upsertPlatformSetting(
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: CreatePlatformSettingDto,
  ) {
    return this.userService.upsertPlatformSetting(dto);
  }

  @Get('all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(USER_ROLE.ADMIN)
  async getAllUsers(
    @Query('page') page = '1',
    @Query('limit') limit = '10',
    @Query('role') role?: USER_ROLE,
    @Query('status') status?: USER_STATUS,
    @Query('technicianProfileStatus') technicianProfileStatus?: TECHNICIAN_STATUS,
    @Query('serviceId') serviceId?: string,
  ) {
    if (serviceId && role !== USER_ROLE.TECHNICIAN) {
      throw new BadRequestException(
        'serviceId is only active for the technician role',
      );
    }
    return this.userService.getAllUsersService(
      Number(page),
      Number(limit),
      role,
      status,
      technicianProfileStatus,
      serviceId ? Number(serviceId) : undefined,
    );
  }

  @Patch('update/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(USER_ROLE.ADMIN)
  async updateUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.userService.updateUserService(id, updateUserDto);
  }

  @Delete('delete/user/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(USER_ROLE.ADMIN)
  async deleteUser(@Param('id', ParseIntPipe) id: number) {
    return this.userService.deleteUserService(id);
  }

  @Get('service/all')
  async getAllServices(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    let isAdmin = req.user?.role === USER_ROLE.ADMIN;
    if (!isAdmin) {
      const authHeader = req.headers?.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const token = authHeader.split(' ')[1];
          const decoded: any = jwt.decode(token);
          if (
            decoded &&
            (decoded.role === USER_ROLE.ADMIN ||
              decoded.role?.toUpperCase() === 'ADMIN')
          ) {
            isAdmin = true;
          }
        } catch (e) { }
      }
    }
    console.log(status);
    console.log(typeof status);
    return this.userService.getAllServices(
      page ? Number(page) : undefined,
      limit ? Number(limit) : undefined,
      isAdmin,
      search,
      status,
    );
  }

  @Get('service/:serviceId/technicians')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(USER_ROLE.ADMIN, USER_ROLE.CUSTOMER)
  @HttpCode(HttpStatus.OK)
  async getTechniciansByServiceId(
    @Param('serviceId', ParseIntPipe) serviceId: number,
  ) {
    return this.userService.getTechniciansByServiceId(serviceId);
  }

  @Get('service/:id')
  async getServiceById(@Param('id') id: string) {
    return this.userService.getServiceById(Number(id));
  }

  @Patch('update/service/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(USER_ROLE.ADMIN)
  @UseInterceptors(FileFieldsInterceptor([{ name: 'icon', maxCount: 1 }]))
  async updateService(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFiles()
    files: {
      icon?: Express.Multer.File[];
    },
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: UpdateServiceDto,
  ) {
    return this.userService.updateService(id, dto, files);
  }

  @Patch('admin/technician/status/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(USER_ROLE.ADMIN)
  @HttpCode(HttpStatus.OK)
  async updateTechnicianStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTechnicianStatusDto,
  ) {
    return this.userService.updateTechnicianStatusService(id, dto);
  }

  @Post('technician/payout-account')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(USER_ROLE.TECHNICIAN)
  @HttpCode(HttpStatus.CREATED)
  async createTechnicianPayoutAccount(
    @Req() req: any,
    @Body(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    )
    dto: CreateTechnicianPayoutAccountDto,
  ) {
    const technicianId =
      req.user.id || req.user.sub;

    const data =
      await this.userService
        .createTechnicianPayoutAccount(
          technicianId,
          dto,
        );

    return {
      success: true,
      message:
        'Technician payout account created successfully',
      data,
    };
  }

  @Patch('technician/payout-account/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(USER_ROLE.TECHNICIAN)
  @HttpCode(HttpStatus.OK)
  async updateTechnicianPayoutAccount(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    )
    dto: UpdateTechnicianPayoutAccountDto,
  ) {
    const technicianId =
      req.user.id || req.user.sub;

    const data =
      await this.userService
        .updateTechnicianPayoutAccount(
          technicianId,
          id,
          dto,
        );

    return {
      success: true,
      message:
        'Technician payout account updated successfully',
      data,
    };
  }

  @Delete('technician/payout-account/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(USER_ROLE.TECHNICIAN)
  @HttpCode(HttpStatus.OK)
  async deleteTechnicianPayoutAccount(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const technicianId =
      req.user.id || req.user.sub;

    const data =
      await this.userService
        .deleteTechnicianPayoutAccount(
          technicianId,
          id,
        );

    return {
      success: true,
      message:
        'Technician payout account deleted successfully',
      data,
    };
  }

  @Get('platform-settings/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(USER_ROLE.ADMIN)
  async getPlatformSettingById(@Param('id', ParseIntPipe) id: number) {
    return this.userService.getPlatformSettingByIdService(id);
  }

  @Post('admin/register')
  @HttpCode(HttpStatus.OK)
  async adminRegister(
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: RegisterDto,
  ) {
    return this.userService.adminRegisterService(dto);
  }

  @Post('register')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'aadharUrl', maxCount: 1 },
      { name: 'panUrl', maxCount: 1 },
      { name: 'policeCertUrl', maxCount: 1 },
      { name: 'tradeLicenseUrl', maxCount: 1 },
      { name: 'selfieUrl', maxCount: 1 },
    ]),
  )
  @HttpCode(HttpStatus.OK)
  async userRegister(
    @UploadedFiles()
    files: {
      aadharUrl?: Express.Multer.File[];
      panUrl?: Express.Multer.File[];
      policeCertUrl?: Express.Multer.File[];
      tradeLicenseUrl?: Express.Multer.File[];
      selfieUrl?: Express.Multer.File[];
    },
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: RegisterDto,
  ) {
    return this.userService.userRegisterService(dto, files);
  }

  @Get('customer/addresses')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(USER_ROLE.CUSTOMER)
  @HttpCode(HttpStatus.OK)
  async getMyAddresses(
    @Req() req: any,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    return this.userService.getMyAddresses(req.user.id, Number(page), Number(limit));
  }

  @Post('customer/token-payment-link')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(USER_ROLE.CUSTOMER)
  @HttpCode(HttpStatus.OK)
  async createTokenPaymentLink(
    @Req() req: any,
    @Query('redirectUrl') redirectUrl?: string,
    @Body('redirectUrl') bodyRedirectUrl?: string,
  ) {
    const callbackUrl = redirectUrl || bodyRedirectUrl;
    return this.userService.createTokenPaymentLinkService(
      req.user.id,
      callbackUrl,
    );
  }

  @Post('customer/address')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(USER_ROLE.CUSTOMER)
  @HttpCode(HttpStatus.OK)
  async addCustomerAddress(
    @Req() req: any,
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: CustomerAddressDto,
  ) {
    return this.userService.addCustomerAddressService(req.user.id, dto);
  }

  @Patch('customer/address/:addressId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(USER_ROLE.CUSTOMER)
  @HttpCode(HttpStatus.OK)
  async updateCustomerAddress(
    @Req() req: any,
    @Param('addressId', ParseIntPipe) addressId: number,
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: UpdateCustomerAddressDto,
  ) {
    return this.userService.updateCustomerAddressService(
      req.user.id,
      addressId,
      dto,
    );
  }

  @Delete('customer/address/:addressId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(USER_ROLE.CUSTOMER)
  @HttpCode(HttpStatus.OK)
  async deleteCustomerAddress(
    @Req() req: any,
    @Param('addressId', ParseIntPipe) addressId: number,
  ) {
    return this.userService.deleteCustomerAddressService(
      req.user.id,
      addressId,
    );
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'profileImage', maxCount: 1 },
      { name: 'pan', maxCount: 1 },
      { name: 'policeCert', maxCount: 1 },
      { name: 'tradeLicense', maxCount: 1 },
      { name: 'selfie', maxCount: 1 },
    ]),
  )
  @HttpCode(HttpStatus.OK)
  async updateProfile(
    @Req() req: any,
    @UploadedFiles()
    files: {
      profileImage?: Express.Multer.File[];
      pan?: Express.Multer.File[];
      policeCert?: Express.Multer.File[];
      tradeLicense?: Express.Multer.File[];
      selfie?: Express.Multer.File[];
    },
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: UpdateProfileDto,
  ) {
    return this.userService.updateProfileService(req.user.id, dto, files);
  }

  @Patch('technician/services')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(USER_ROLE.TECHNICIAN)
  @HttpCode(HttpStatus.OK)
  async updateTechnicianServices(
    @Req() req: any,
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: UpdateTechnicianServicesDto,
  ) {
    return this.userService.updateTechnicianServices(req.user.id, dto);
  }

  @Post('technician/location')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(USER_ROLE.TECHNICIAN)
  @HttpCode(HttpStatus.CREATED)
  async createTechnicianLocation(
    @Req() req: any,
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: CreateTechnicianLocationDto,
  ) {
    const userId = req.user.id || req.user.sub;
    return this.userService.createTechnicianLocation(userId, dto);
  }

  @Patch('technician/location/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(USER_ROLE.TECHNICIAN)
  @HttpCode(HttpStatus.OK)
  async updateTechnicianLocation(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: UpdateTechnicianLocationDto,
  ) {
    const technicianId = req.user.id || req.user.sub;
    return this.userService.updateTechnicianLocation(technicianId, id, dto);
  }

  @Delete('technician/location/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(USER_ROLE.TECHNICIAN)
  @HttpCode(HttpStatus.OK)
  async deleteTechnicianLocation(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const technicianId = req.user.id || req.user.sub;
    return this.userService.deleteTechnicianLocation(technicianId, id);
  }

  @Patch('technician/brand-expertise')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(USER_ROLE.TECHNICIAN)
  @HttpCode(HttpStatus.OK)
  async updateTechnicianBrandExpertise(
    @Req() req: any,
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: UpdateTechnicianBrandExpertiseDto,
  ) {
    const userId = req.user.id || req.user.sub;
    return this.userService.updateTechnicianBrandExpertise(userId, dto);
  }

  @Get('admin/dashboard-stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(USER_ROLE.ADMIN)
  @HttpCode(HttpStatus.OK)
  async getAdminDashboardStats() {
    const data =
      await this.userService
        .getAdminDashboardStats();

    return {
      success: true,
      message:
        'Admin dashboard statistics fetched successfully',
      data,
    };
  }

  @Get('customer/dashboard-stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(USER_ROLE.CUSTOMER)
  @HttpCode(HttpStatus.OK)
  async getCustomerDashboardStats(@Req() req: any) {
    return this.userService.getCustomerDashboardStats(req.user.id);
  }

  @Get('technician/dashboard-stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(USER_ROLE.TECHNICIAN)
  @HttpCode(HttpStatus.OK)
  async getTechnicianDashboardStats(
    @Req() req: any,
  ) {
    const technicianId = Number(
      req.user.id ?? req.user.sub,
    );

    const data =
      await this.userService
        .getTechnicianDashboardStats(
          technicianId,
        );

    return {
      success: true,
      message:
        'Technician dashboard stats fetched successfully',
      data,
    };
  }

  @Post('favorite-technicians/:technicianId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(USER_ROLE.CUSTOMER)
  favoriteTechnician(
    @Req() req,
    @Param('technicianId', ParseIntPipe)
    technicianId: number,
  ) {
    return this.userService.favoriteTechnician(
      req.user,
      technicianId,
    );
  }

  @Get('favourite-technicians')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(USER_ROLE.CUSTOMER)
  @HttpCode(HttpStatus.OK)
  async getFavouriteTechnicians(@Req() req: any) {
    return this.userService.getFavouriteTechnicians(req.user.id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getUserById(@Param('id', ParseIntPipe) id: number) {
    return this.userService.getUserByIdService(id);
  }

  @Cron('*/30 * * * * *')
  async handlePhoneScramblerCron() {
    if (process.env.NODE_ENV === 'production') {
      return;
    }
    await this.userService.scramblePhoneNumbers();
  }
}
