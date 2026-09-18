import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContactUs, CONTACT_US_STATUS } from '@hichandra/entities';
import {
  CreateContactUsDto,
  GetAllContactUsDto,
  UpdateContactUsStatusDto,
} from '@hichandra/dtos';
import { EmailService } from '@hichandra/email-services';

@Injectable()
export class ContactUsService {
  private readonly logger = new Logger(ContactUsService.name);

  constructor(
    @InjectRepository(ContactUs)
    private readonly contactUsRepository: Repository<ContactUs>,
    private readonly emailService: EmailService,
  ) {}

  async create(createContactUsDto: CreateContactUsDto) {
    const contactUs = this.contactUsRepository.create({
      ...createContactUsDto,
      status: CONTACT_US_STATUS.DRAFT,
    });

    const saved = await this.contactUsRepository.save(contactUs);

    return {
      success: true,
      message: 'Your message has been submitted successfully',
      data: saved,
    };
  }

  async getAll(query: GetAllContactUsDto) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;

    const queryBuilder = this.contactUsRepository.createQueryBuilder('contactUs');

    if (query.status) {
      queryBuilder.andWhere('contactUs.status = :status', {
        status: query.status,
      });
    }

    if (query.search && query.search.trim().length > 0) {
      queryBuilder.andWhere(
        '(contactUs.name ILIKE :search OR contactUs.email ILIKE :search OR contactUs.subject ILIKE :search)',
        { search: `%${query.search.trim()}%` },
      );
    }

    queryBuilder.orderBy('contactUs.createdAt', 'DESC');
    queryBuilder.skip((page - 1) * limit).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      success: true,
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getById(id: number) {
    const contactUs = await this.contactUsRepository.findOne({
      where: { id },
    });

    if (!contactUs) {
      throw new NotFoundException(`Contact Us entry #${id} not found`);
    }

    return {
      success: true,
      data: contactUs,
    };
  }

  async updateStatus(id: number, updateDto: UpdateContactUsStatusDto) {
    const contactUs = await this.contactUsRepository.findOne({
      where: { id },
    });

    if (!contactUs) {
      throw new NotFoundException(`Contact Us entry #${id} not found`);
    }

    // Status cannot be changed back to DRAFT once marked as READ
    if (
      contactUs.status === CONTACT_US_STATUS.READ &&
      updateDto.status === CONTACT_US_STATUS.DRAFT
    ) {
      throw new BadRequestException(
        'Status cannot be changed back to DRAFT once it has been marked as READ',
      );
    }

    contactUs.status = updateDto.status;
    const updated = await this.contactUsRepository.save(contactUs);

    // Send email to user with Admin's message
    try {
      const subject = `Update regarding your inquiry: ${contactUs.subject} - HiChandra`;
      await this.emailService.sendTemplateEmail(contactUs.email, subject, {
        emailTitle: subject,
        badgeText: `Status: ${contactUs.status}`,
        mainHeading: 'Response to Your Inquiry',
        userName: contactUs.name,
        messageText: `<p style="margin: 0; white-space: pre-line;">${updateDto.message}</p>`,
        details: [
          { label: 'Inquiry Subject', value: contactUs.subject },
          { label: 'Inquiry Status', value: contactUs.status },
        ],
        footerNote:
          'If you have any further questions or need additional assistance, feel free to reply to this email or contact HiChandra 24/7 Support.',
      });
    } catch (error) {
      this.logger.error(
        `Failed to send inquiry response email to ${contactUs.email}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return {
      success: true,
      message: 'Status updated and email sent to user successfully',
      data: updated,
    };
  }

  async softDelete(id: number) {
    const contactUs = await this.contactUsRepository.findOne({
      where: { id },
    });

    if (!contactUs) {
      throw new NotFoundException(`Contact Us entry #${id} not found`);
    }

    await this.contactUsRepository.softDelete(id);

    return {
      success: true,
      message: 'Contact Us entry deleted successfully',
    };
  }
}
