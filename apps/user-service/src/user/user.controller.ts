import { Body, Controller, Get, Post, Req, UnauthorizedException, UseGuards, UseInterceptors, ValidationPipe } from "@nestjs/common";
import { UserService } from "./user.service";
import { AuthGuard } from "@nestjs/passport";
import { JwtAuthGuard } from "@optechular/common";

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

    
}