import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PlatformSetting } from '@hichandra/entities';
import { BaseRepository } from './baseDb.repository';

@Injectable()
export class PlatformSettingRepository extends BaseRepository<PlatformSetting> {
    constructor(
        @InjectRepository(PlatformSetting)
        repo: Repository<PlatformSetting>,
    ) {
        super(repo);
    }

    async findAllPlatformSettings() {
        return this.repo.find({
            order: {
                createdAt: 'DESC',
            },
        });
    }

    async findByFilter(filter: string) {
        const isId = !isNaN(Number(filter));

        if (isId) {
            return this.repo.findOne({
                where: {
                    id: Number(filter),
                },
            });
        }

        return this.repo.findOne({
            where: {
                key: filter,
            },
        });
    }
}