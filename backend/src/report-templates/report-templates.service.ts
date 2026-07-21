import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReportTemplate } from './entities/report-template.entity';

@Injectable()
export class ReportTemplatesService {
  constructor(
    @InjectRepository(ReportTemplate)
    private readonly repository: Repository<ReportTemplate>,
  ) {}

  async create(dto: { name: string; headerText?: string; footerText?: string; userId: string; companyId?: string }) {
    const template = this.repository.create(dto);
    return this.repository.save(template);
  }

  async findAll(userId: string) {
    return this.repository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string) {
    return this.repository.findOne({ where: { id } });
  }

  async update(id: string, dto: { name?: string; headerText?: string; footerText?: string }) {
    await this.repository.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: string) {
    const template = await this.findOne(id);
    if (!template) {
      throw new Error('Template not found');
    }
    return this.repository.remove(template);
  }
}
