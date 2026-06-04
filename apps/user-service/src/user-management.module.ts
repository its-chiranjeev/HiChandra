import { Module } from "@nestjs/common";
import { UserManagementController } from "./user-management.controller";
import { UserService } from "./user/user.service";
import { UserModule } from "./user/user.module";
import { DatabaseModule } from '@hichandra/database';
import { UserManagementService } from "./user-management.service";
import { EntitiesModule } from '@hichandra/entities';
//import { CategoryModule } from "./category/category.module";
//import { ProductModule } from "./product/product.module";
//import { SupplierModule } from "./supplier/supplier.module";

@Module({
    imports: [DatabaseModule, EntitiesModule, UserModule],
    controllers: [UserManagementController],
    providers: [UserManagementService],
})
export class UserManagementModule {}