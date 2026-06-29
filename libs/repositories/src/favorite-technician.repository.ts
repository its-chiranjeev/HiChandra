import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FavoriteTechnician } from '@hichandra/entities';
import { Repository } from 'typeorm';

@Injectable()
export class FavoriteTechnicianRepository {
  constructor(
    @InjectRepository(FavoriteTechnician)
    private readonly repo: Repository<FavoriteTechnician>,
  ) {}

  async createFavoriteTechnician(
    data: Partial<FavoriteTechnician>,
  ): Promise<FavoriteTechnician> {
    const favorite = this.repo.create(data);

    return this.repo.save(favorite);
  }

  async findFavoriteTechnician(
    customerId: number,
    technicianId: number,
  ): Promise<FavoriteTechnician | null> {
    return this.repo.findOne({
      where: {
        customerId,
        technicianId,
      },
    });
  }

  async saveFavoriteTechnician(
    favorite: FavoriteTechnician,
  ): Promise<FavoriteTechnician> {
    return this.repo.save(favorite);
  }

  async findFavoriteById(
    id: number,
  ): Promise<FavoriteTechnician | null> {
    return this.repo.findOne({
      where: {
        id,
      },
    });
  }

  async removeFavoriteTechnician(
    favorite: FavoriteTechnician,
  ): Promise<FavoriteTechnician> {
    return this.repo.remove(favorite);
  }
}