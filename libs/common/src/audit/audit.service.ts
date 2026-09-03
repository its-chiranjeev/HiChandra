import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { AuditLog, ACTOR_TYPE, AUDIT_MODULE } from '@hichandra/entities';

export interface CreateAuditLogDto {
  actorId?: number | null;
  actorType: ACTOR_TYPE;
  actorRole?: string | null;
  module: AUDIT_MODULE;
  entity: string;
  entityId?: string | null;
  action: string;
  message: string;
  oldValue?: Record<string, any> | null;
  newValue?: Record<string, any> | null;
  metadata?: Record<string, any> | null;
  ipAddress?: string | null;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  // Sensitive fields that should be masked or removed
  private readonly SENSITIVE_KEYS = new Set([
    'password',
    'hashedPassword',
    'otp',
    'accessToken',
    'refreshToken',
    'token',
    'secret',
    'authorization',
    'cardNumber',
    'cvv',
    'upiPin',
    'accountNumber',
  ]);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  /**
   * Create a new audit log entry.
   * If an EntityManager is provided, it will participate in the existing transaction.
   */
  async create(dto: CreateAuditLogDto, manager?: EntityManager): Promise<AuditLog | null> {
    try {
      const auditLog = new AuditLog();
      
      // Map basic fields
      auditLog.actorId = dto.actorId ?? undefined;
      auditLog.actorType = dto.actorType;
      auditLog.actorRole = dto.actorRole ?? undefined;
      auditLog.module = dto.module;
      auditLog.entity = dto.entity;
      auditLog.entityId = dto.entityId ?? undefined;
      auditLog.action = dto.action;
      
      // Dynamic role formatting for the message (e.g. 'Admin created...' instead of just replacing it blindly, we let the caller pass the message or we format it here)
      // The prompt specified that caller will pass dynamic message.
      auditLog.message = dto.message;
      
      // Sanitize fields
      auditLog.oldValue = dto.oldValue ? this.sanitizeData(dto.oldValue) : undefined;
      auditLog.newValue = dto.newValue ? this.sanitizeData(dto.newValue) : undefined;
      auditLog.metadata = dto.metadata ? this.sanitizeData(dto.metadata) : undefined;
      auditLog.ipAddress = dto.ipAddress ?? undefined;

      const targetRepo = manager ? manager.getRepository(AuditLog) : this.auditLogRepository;
      
      return await targetRepo.save(auditLog);
    } catch (error) {
      // We don't want audit log failures to break the main application flow,
      // but we should definitely log the error.
      this.logger.error(`Failed to create audit log: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * Recursively sanitizes an object by removing or masking sensitive fields.
   */
  private sanitizeData(data: Record<string, any>): Record<string, any> {
    if (!data || typeof data !== 'object') {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.sanitizeData(item)) as unknown as Record<string, any>;
    }

    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      
      // Check if key is sensitive
      let isSensitive = false;
      for (const sensitiveKey of this.SENSITIVE_KEYS) {
        if (lowerKey.includes(sensitiveKey.toLowerCase())) {
          isSensitive = true;
          break;
        }
      }

      if (isSensitive) {
        // Mask specific types like account numbers differently if needed
        if (lowerKey.includes('accountnumber') && typeof value === 'string' && value.length > 4) {
          sanitized[key] = `********${value.slice(-4)}`;
        } else {
          sanitized[key] = '[REDACTED]';
        }
      } else if (value && typeof value === 'object') {
        sanitized[key] = this.sanitizeData(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    filters?: { module?: string; action?: string; actorId?: number },
  ) {
    const queryBuilder = this.auditLogRepository.createQueryBuilder('auditLog');

    if (filters?.module) {
      queryBuilder.andWhere('auditLog.module = :module', { module: filters.module });
    }
    if (filters?.action) {
      queryBuilder.andWhere('auditLog.action = :action', { action: filters.action });
    }
    if (filters?.actorId) {
      queryBuilder.andWhere('auditLog.actorId = :actorId', { actorId: filters.actorId });
    }

    queryBuilder.orderBy('auditLog.createdAt', 'DESC');
    queryBuilder.skip((page - 1) * limit).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
