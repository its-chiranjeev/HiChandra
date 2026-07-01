import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan  } from 'typeorm';
import { Otp } from '@hichandra/entities';
import { BaseRepository } from './baseDb.repository';

@Injectable()
export class OtpRepository extends BaseRepository<Otp> {
  constructor(
    @InjectRepository(Otp)
    repo: Repository<Otp>,
  ) {
    super(repo);
  }

  async findLatestValidOtp(
    email?: string,
    phone?: string,
  ): Promise<Otp | null> {
    const query: any = {
      isUsed: false,
    };
    if (email) {
      query.email = email;
    } else if (phone) {
      query.phone = phone;
    } else {
      return null;
    }

    return this.repo.findOne({
      where: query,
      order: { createdAt: 'DESC' },
    });
  }

    async deleteExpiredOtps(): Promise<number> {
    const result = await this.repo.delete({
      expiresAt: LessThan(new Date()),
    });

    return result.affected ?? 0;
  }
}
