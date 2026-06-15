import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { DatabaseModule } from '@hichandra/database';
import { EntitiesModule } from '@hichandra/entities';
import { AuthModuleModule } from './auth/auth-module.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
    EntitiesModule,
    AuthModuleModule,
  ],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
