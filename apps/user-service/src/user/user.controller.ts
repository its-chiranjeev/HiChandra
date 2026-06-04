import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UnauthorizedException, UploadedFiles, UseGuards, UseInterceptors, ValidationPipe } from "@nestjs/common";
import { UserService } from "./user.service";
import { AuthGuard } from "@nestjs/passport";
import { JwtAuthGuard } from "@hichandra/common";
import { RegisterDto } from "@hichandra/dtos";
import { FileFieldsInterceptor } from "@nestjs/platform-express";

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) { }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Req() req: any) {
    if (!req.user || !req.user.id) {
      throw new UnauthorizedException('User not authenticated');
    }
    return this.userService.findById(req.user.id);
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

}