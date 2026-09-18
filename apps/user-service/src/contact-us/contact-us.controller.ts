import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Delete,
  Query,
  ParseIntPipe,
  UseGuards,
  ValidationPipe,
  Patch,
} from '@nestjs/common';
import { ContactUsService } from './contact-us.service';
import {
  CreateContactUsDto,
  GetAllContactUsDto,
  UpdateContactUsStatusDto,
} from '@hichandra/dtos';
import { JwtAuthGuard, RolesGuard, Roles } from '@hichandra/common';
import { USER_ROLE } from '@hichandra/entities';

@Controller('contact-us')
export class ContactUsController {
  constructor(private readonly contactUsService: ContactUsService) {}

  // Public submission endpoint - supports both /api/contact-us and /api/contact-us/add
  @Post(['', 'add'])
  create(
    @Body(new ValidationPipe({ whitelist: true }))
    createContactUsDto: CreateContactUsDto,
  ) {
    return this.contactUsService.create(createContactUsDto);
  }

  @Get('all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(USER_ROLE.ADMIN)
  getAll(
    @Query(new ValidationPipe({ whitelist: true, transform: true }))
    query: GetAllContactUsDto,
  ) {
    return this.contactUsService.getAll(query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(USER_ROLE.ADMIN)
  getById(@Param('id', ParseIntPipe) id: number) {
    return this.contactUsService.getById(id);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(USER_ROLE.ADMIN)
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ValidationPipe({ whitelist: true }))
    updateDto: UpdateContactUsStatusDto,
  ) {
    return this.contactUsService.updateStatus(id, updateDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(USER_ROLE.ADMIN)
  softDelete(@Param('id', ParseIntPipe) id: number) {
    return this.contactUsService.softDelete(id);
  }
}
