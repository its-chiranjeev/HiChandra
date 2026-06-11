import { Module } from '@nestjs/common';
import { AssignmentService } from './assignment.service';
import { GatewayModule } from '@hichandra/gateway';

@Module({
  imports: [GatewayModule],
  providers: [AssignmentService],
  exports: [AssignmentService],
})
export class AssignmentModule { }
