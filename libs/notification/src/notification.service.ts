import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { NotificationRepository } from '@hichandra/repositories';
import { BookingGateway } from '@hichandra/gateway';
import { Notification, NOTIFICATION_TYPE } from '@hichandra/entities';
import { GetNotificationsDto } from '@hichandra/dtos';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly notificationRepository: NotificationRepository,
    private readonly bookingGateway: BookingGateway,
  ) {}

  /**
   * Internal notification creation method.
   * 1. Persists the notification to the database FIRST.
   * 2. Emits `notification` real-time event via existing BookingGateway.
   * 3. Calculates the updated unread count and emits `unread_notification_count`.
   * Real-time socket failures are caught and logged so primary business operations never fail.
   */
  async createNotification(
    userId: number,
    title: string,
    message: string,
    type: NOTIFICATION_TYPE = NOTIFICATION_TYPE.SYSTEM,
    referenceId?: number,
    referenceType?: string,
  ): Promise<Notification | null> {
    try {
      // 1. Persist notification first
      const notification = await this.notificationRepository.createNotification({
        userId,
        title,
        message,
        type,
        referenceId,
        referenceType,
        isRead: false,
      });

      // 2. Real-time emission via existing BookingGateway
      try {
        this.bookingGateway.emitToUser(userId, 'notification', notification);

        const unreadCount = await this.notificationRepository.countUnread(userId);
        this.bookingGateway.emitToUser(userId, 'unread_notification_count', {
          unreadCount,
        });
      } catch (socketErr) {
        this.logger.warn(
          `Failed to emit Socket.io notification to user ${userId}: ${socketErr instanceof Error ? socketErr.message : String(socketErr)}`,
        );
      }

      return notification;
    } catch (error) {
      this.logger.error(
        `Failed to persist notification for user ${userId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  /**
   * Fetch paginated notifications for the authenticated user.
   */
  async getUserNotifications(
    userId: number,
    query: GetNotificationsDto,
  ) {
    const page = query.page || 1;
    const limit = query.limit || 10;

    const result = await this.notificationRepository.findUserNotifications(
      userId,
      page,
      limit,
      query.isRead,
      query.type,
    );

    return {
      success: true,
      message: 'Notifications retrieved successfully',
      data: {
        notifications: result.notifications,
        total: result.total,
        unreadCount: result.unreadCount,
        page,
        limit,
        totalPages: Math.ceil(result.total / limit),
      },
    };
  }

  /**
   * Get unread notification count for authenticated user.
   */
  async getUnreadCount(userId: number) {
    const unreadCount = await this.notificationRepository.countUnread(userId);
    return {
      success: true,
      message: 'Unread notification count retrieved successfully',
      data: {
        unreadCount,
      },
    };
  }

  /**
   * Mark a single notification as read (user-isolated).
   */
  async markAsRead(id: number, userId: number) {
    const updated = await this.notificationRepository.markAsRead(id, userId);
    if (!updated) {
      throw new NotFoundException('Notification not found or access denied');
    }

    try {
      const unreadCount = await this.notificationRepository.countUnread(userId);
      this.bookingGateway.emitToUser(userId, 'unread_notification_count', {
        unreadCount,
      });
    } catch (socketErr) {
      this.logger.warn(
        `Failed to emit unread count update for user ${userId}: ${socketErr instanceof Error ? socketErr.message : String(socketErr)}`,
      );
    }

    return {
      success: true,
      message: 'Notification marked as read',
      data: updated,
    };
  }

  /**
   * Mark all unread notifications as read for authenticated user.
   */
  async markAllAsRead(userId: number) {
    await this.notificationRepository.markAllAsRead(userId);

    try {
      this.bookingGateway.emitToUser(userId, 'unread_notification_count', {
        unreadCount: 0,
      });
    } catch (socketErr) {
      this.logger.warn(
        `Failed to emit unread count update for user ${userId}: ${socketErr instanceof Error ? socketErr.message : String(socketErr)}`,
      );
    }

    return {
      success: true,
      message: 'All notifications marked as read',
    };
  }

  /**
   * Soft-delete a notification (user-isolated).
   */
  async deleteNotification(id: number, userId: number) {
    const deleted = await this.notificationRepository.softDeleteNotification(id, userId);
    if (!deleted) {
      throw new NotFoundException('Notification not found or access denied');
    }

    try {
      const unreadCount = await this.notificationRepository.countUnread(userId);
      this.bookingGateway.emitToUser(userId, 'unread_notification_count', {
        unreadCount,
      });
    } catch (socketErr) {
      this.logger.warn(
        `Failed to emit unread count update for user ${userId}: ${socketErr instanceof Error ? socketErr.message : String(socketErr)}`,
      );
    }

    return {
      success: true,
      message: 'Notification deleted successfully',
    };
  }
}
