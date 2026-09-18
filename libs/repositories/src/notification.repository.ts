import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Notification, NOTIFICATION_TYPE } from '@hichandra/entities';
import { Repository, IsNull } from 'typeorm';

@Injectable()
export class NotificationRepository {
  constructor(
    @InjectRepository(Notification)
    private readonly repo: Repository<Notification>,
  ) {}

  async createNotification(
    data: Partial<Notification>,
  ): Promise<Notification> {
    const notification = this.repo.create(data);
    return this.repo.save(notification);
  }

  async findUserNotifications(
    userId: number,
    page: number = 1,
    limit: number = 10,
    isRead?: boolean,
    type?: NOTIFICATION_TYPE,
  ): Promise<{ notifications: Notification[]; total: number; unreadCount: number }> {
    const where: any = {
      userId,
      deletedAt: IsNull(),
    };

    if (isRead !== undefined) {
      where.isRead = isRead;
    }

    if (type !== undefined) {
      where.type = type;
    }

    const [notifications, total] = await this.repo.findAndCount({
      where,
      order: {
        createdAt: 'DESC',
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    const unreadCount = await this.countUnread(userId);

    return {
      notifications,
      total,
      unreadCount,
    };
  }

  async countUnread(userId: number): Promise<number> {
    return this.repo.count({
      where: {
        userId,
        isRead: false,
        deletedAt: IsNull(),
      },
    });
  }

  async findNotificationById(
    id: number,
    userId: number,
  ): Promise<Notification | null> {
    return this.repo.findOne({
      where: {
        id,
        userId,
        deletedAt: IsNull(),
      },
    });
  }

  async markAsRead(
    id: number,
    userId: number,
  ): Promise<Notification | null> {
    const notification = await this.findNotificationById(id, userId);
    if (!notification) {
      return null;
    }

    if (!notification.isRead) {
      notification.isRead = true;
      notification.readAt = new Date();
      return this.repo.save(notification);
    }

    return notification;
  }

  async markAllAsRead(userId: number): Promise<void> {
    await this.repo.update(
      {
        userId,
        isRead: false,
        deletedAt: IsNull(),
      },
      {
        isRead: true,
        readAt: new Date(),
      },
    );
  }

  async softDeleteNotification(
    id: number,
    userId: number,
  ): Promise<boolean> {
    const notification = await this.findNotificationById(id, userId);
    if (!notification) {
      return false;
    }

    await this.repo.softDelete({ id, userId });
    return true;
  }
}
