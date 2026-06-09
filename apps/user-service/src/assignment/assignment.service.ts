import { Injectable, Logger } from '@nestjs/common';
import { Booking } from '@hichandra/entities';

@Injectable()
export class AssignmentService {
  private readonly logger = new Logger(AssignmentService.name);

  async autoAssign(booking: Booking): Promise<void> {
    this.logger.log(`Auto assigning booking ${booking.id}...`);
    // Placeholder assignment logic
  }
}
