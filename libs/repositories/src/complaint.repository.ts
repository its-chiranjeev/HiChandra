import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Complaint, COMPLAINT_STATUS } from '@hichandra/entities';
import { Repository } from 'typeorm';

@Injectable()
export class ComplaintRepository {
  constructor(
    @InjectRepository(Complaint)
    private readonly repo: Repository<Complaint>,
  ) { }

  async createComplaint(
    data: Partial<Complaint>,
  ): Promise<Complaint> {
    const complaint = this.repo.create(data);

    return this.repo.save(complaint);
  }

  async saveComplaint(
    complaint: Complaint,
  ): Promise<Complaint> {
    return this.repo.save(complaint);
  }

  async findPendingComplaint(
    bookingId: number,
    serviceId: number,
  ): Promise<Complaint | null> {
    return this.repo.findOne({
      where: {
        bookingId,
        serviceId,
        status: COMPLAINT_STATUS.PENDING,
      },
    });
  }

  async findComplaintById(
  complaintId: number,
): Promise<Complaint | null> {
  return this.repo.findOne({
    where: {
      id: complaintId,
    },
  });
}

  async findAllComplaints(
    page: number,
    limit: number,
    status?: COMPLAINT_STATUS,
  ) {
    const query = this.repo
      .createQueryBuilder('complaint')
      .leftJoinAndSelect(
        'complaint.booking',
        'booking',
      )
      .leftJoinAndSelect(
        'complaint.createdByUser',
        'createdByUser',
      );

    if (status) {
      query.andWhere(
        'complaint.status = :status',
        { status },
      );
    }

    query.orderBy(
      'complaint.createdAt',
      'DESC',
    );

    const [complaints, total] =
      await query
        .skip((page - 1) * limit)
        .take(limit)
        .getManyAndCount();

    return {
      complaints,
      total,
    };
  }
}