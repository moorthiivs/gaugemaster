import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './audit-log.entity';

@Injectable()
export class AuditLogsService {
  constructor(
    @InjectRepository(AuditLog)
    private auditLogsRepository: Repository<AuditLog>,
  ) {}

  async createLog(data: Partial<AuditLog>): Promise<AuditLog> {
    const log = this.auditLogsRepository.create(data);
    return this.auditLogsRepository.save(log);
  }

  async findByCompany(
    companyId: string,
    options?: {
      limit?: number;
      action?: string;
      status?: string;
      resourceType?: string;
      dateFrom?: string;
      dateTo?: string;
      search?: string;
    },
  ): Promise<AuditLog[]> {
    const limit = Math.min(options?.limit || 200, 1000);
    const query = this.auditLogsRepository.createQueryBuilder('log')
      .leftJoinAndSelect('log.user', 'user')
      .where('log.companyId = :companyId', { companyId })
      .orderBy('log.createdAt', 'DESC')
      .take(limit);

    if (options?.action) {
      query.andWhere('log.action = :action', { action: options.action });
    }

    if (options?.status) {
      query.andWhere('log.status = :status', { status: options.status });
    }

    if (options?.resourceType) {
      query.andWhere('log.resourceType = :resourceType', { resourceType: options.resourceType });
    }

    if (options?.dateFrom) {
      query.andWhere('log.createdAt >= :dateFrom', { dateFrom: options.dateFrom });
    }

    if (options?.dateTo) {
      query.andWhere('log.createdAt <= :dateTo', { dateTo: options.dateTo });
    }

    if (options?.search) {
      query.andWhere(
        '(log.description ILIKE :search OR log.action ILIKE :search OR log.resource ILIKE :search OR user.name ILIKE :search OR user.email ILIKE :search)',
        { search: `%${options.search}%` },
      );
    }

    return query.getMany();
  }
}
