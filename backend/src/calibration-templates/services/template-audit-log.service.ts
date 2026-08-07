import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TemplateAuditLog } from '../entities/template-audit-log.entity';

@Injectable()
export class TemplateAuditLogService {
  constructor(
    @InjectRepository(TemplateAuditLog)
    private readonly auditRepository: Repository<TemplateAuditLog>,
  ) {}

  async logAction(params: {
    action: 'EXPORT' | 'IMPORT';
    sourceCompanyId?: string;
    destinationCompanyId?: string;
    performedByUserId?: string;
    performedByName?: string;
    templateCount: number;
    successCount: number;
    failureCount: number;
    details?: Record<string, any>;
  }): Promise<TemplateAuditLog> {
    const entry = this.auditRepository.create(params);
    return this.auditRepository.save(entry);
  }

  async findAll(companyId?: string): Promise<TemplateAuditLog[]> {
    const qb = this.auditRepository.createQueryBuilder('log');
    if (companyId) {
      qb.where('log.sourceCompanyId = :companyId OR log.destinationCompanyId = :companyId', { companyId });
    }
    qb.orderBy('log.createdAt', 'DESC');
    return qb.getMany();
  }
}
