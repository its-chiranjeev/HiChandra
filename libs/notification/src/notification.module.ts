import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { EntitiesModule } from '@hichandra/entities';
import { RepositoriesModule } from '@hichandra/repositories';
import { GatewayModule } from '@hichandra/gateway';

@Module({
  imports: [
    EntitiesModule,
    RepositoriesModule,
    GatewayModule,
  ],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
