import { Module } from "@nestjs/common";
import { UserManagementController } from "./user-management.controller";
import { UserService } from "./user/user.service";
import { UserModule } from "./user/user.module";
import { DatabaseModule } from '@hichandra/database';
import { UserManagementService } from "./user-management.service";
import { EntitiesModule } from '@hichandra/entities';

@Module({
    imports: [DatabaseModule, EntitiesModule, UserModule],
    controllers: [UserManagementController],
    providers: [UserManagementService],
})
export class UserManagementModule { }