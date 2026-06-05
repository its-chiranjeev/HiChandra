import { Module } from "@nestjs/common";
import { UserManagementController } from "./user-management.controller";
import { UserModule } from "./user/user.module";

import { DatabaseModule } from '@hichandra/database';
import { UserManagementService } from "./user-management.service";
import { EntitiesModule } from '@hichandra/entities';
import { ConfigModule } from "@nestjs/config";

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
        }),
        DatabaseModule,
        EntitiesModule,
        UserModule,
    ],
    controllers: [UserManagementController],
    providers: [UserManagementService],
})
export class UserManagementModule { }