import { FileFieldsInterceptor } from "@nestjs/platform-express";
import { Body, Controller, Query, Get, Put, Patch, Delete, Param, ParseIntPipe, HttpCode, HttpStatus, Post, Req, UnauthorizedException, UseGuards, UseInterceptors, ValidationPipe, UploadedFiles, UnprocessableEntityException } from "@nestjs/common";
import { UserService } from "./user.service";
import { AuthGuard } from "@nestjs/passport";
import { JwtAuthGuard, Roles, RolesGuard } from "@hichandra/common";
import { RegisterDto, UpdateUserDto, CreateServiceDto, CreatePlatformSettingDto, CustomerAddressDto, UpdateCustomerAddressDto, UpdateProfileDto, AssignBookingDto } from "@hichandra/dtos";
import { USER_ROLE, USER_STATUS } from '@hichandra/entities';
import { filter } from 'rxjs';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

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

  // @Delete('admin/service/:id')
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(USER_ROLE.ADMIN)
  // @HttpCode(HttpStatus.OK)
  // async deleteService(
  //   @Param('id', ParseIntPipe) id: number,
  // ) {
  //   return this.userService.deleteService(id);
  // }

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
  @UseGuards(JwtAuthGuard)
  async getAllUsers(
    @Query('page') page = '1',
    @Query('limit') limit = '10',
    @Query('role') role?: USER_ROLE,
    @Query('status') status?: USER_STATUS,
  ) {
    return this.userService.getAllUsersService(
      Number(page),
      Number(limit),
      role,
      status,
    );
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getUserById(@Param('id', ParseIntPipe) id: number) {
    return this.userService.getUserByIdService(id);
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

  @Delete('delete/service/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(USER_ROLE.ADMIN)
  async deleteUser(@Param('id', ParseIntPipe) id: number) {
    return this.userService.deleteUserService(id);
  }

  @Get('service/all')
  async getAllServices(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.userService.getAllServices(
      page ? Number(page) : undefined,
      limit ? Number(limit) : undefined,
    );
  }

  @Get('service/:id')
  async getServiceById(@Param('id') id: string) {
    return this.userService.getServiceById(Number(id));
  }

  @Get('platform-settings/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(USER_ROLE.ADMIN)
  async getAllPlatformSettings(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('filter') filter?: string,
  ) {
    return this.userService.getAllPlatformSettingsService(
      Number(page),
      Number(limit),
      filter,
    );
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
    FileFieldsInterceptor([{ name: 'profileImage', maxCount: 1 }]),
  )
  @HttpCode(HttpStatus.OK)
  async updateProfile(
    @Req() req: any,
    @UploadedFiles()
    files: {
      profileImage?: Express.Multer.File[];
    },
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: UpdateProfileDto,
  ) {
    return this.userService.updateProfileService(req.user.id, dto, files);
  }
}

