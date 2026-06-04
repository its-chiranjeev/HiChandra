import { Body, Controller, Query,Get, Patch, Delete, Param,ParseIntPipe, HttpCode, HttpStatus, Post, Req, UnauthorizedException, UseGuards, UseInterceptors, ValidationPipe } from "@nestjs/common";
import { UserService } from "./user.service";
import { AuthGuard } from "@nestjs/passport";
import { JwtAuthGuard , Roles, RolesGuard} from "@hichandra/common";
import { RegisterDto, UpdateUserDto } from "@hichandra/dtos";
import { USER_ROLE } from '@hichandra/entities';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) { }


  @Get('all')
  async getAllUsers(
  @Query('page') page = '1',
  @Query('limit') limit = '10',
  ) {
  return this.userService.getAllUsersService(
    Number(page),
    Number(limit),
  );
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getUserById(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.userService.getUserByIdService(id);
  }

  @Patch('update/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(USER_ROLE.ADMIN)
  async updateUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.userService.updateUserService(
      id,
      updateUserDto,
    );
  }

  @Delete('delete/:id')
  @UseGuards(JwtAuthGuard)
  async deleteUser(
   @Param('id', ParseIntPipe) id: number,
  ) {
  return this.userService.deleteUserService(id);
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
  @HttpCode(HttpStatus.OK)
  async userRegister(
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: RegisterDto,
  ) {
    return this.userService.userRegisterService(dto);
  }

}