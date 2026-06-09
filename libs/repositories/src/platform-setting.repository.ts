import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PlatformSetting } from '@hichandra/entities';
import { BaseRepository } from './baseDb.repository';
import { ILike } from 'typeorm';

@Injectable()
export class PlatformSettingRepository extends BaseRepository<PlatformSetting> {
    constructor(
        @InjectRepository(PlatformSetting)
        repo: Repository<PlatformSetting>,
    ) {
        super(repo);
    }


    async findAllPlatformSettings(filter?: string) {

        if (!filter) {
            return this.repo.find({
                order: {
                    createdAt: 'DESC',
                },
            });
        }

        return this.repo.find({
            where: {
                key: ILike(`%${filter}%`),
            },
            order: {
                createdAt: 'DESC',
            },
        });
    }

}