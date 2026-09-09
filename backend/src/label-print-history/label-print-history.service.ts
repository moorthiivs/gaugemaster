import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LabelPrintHistory } from './label-print-history.entity';
import { CreateLabelPrintHistoryDto } from './dto/create-label-print-history.dto';

@Injectable()
export class LabelPrintHistoryService {
  constructor(
    @InjectRepository(LabelPrintHistory)
    private readonly historyRepository: Repository<LabelPrintHistory>,
  ) {}

  async create(
    userId: string,
    companyId: string,
    dto: CreateLabelPrintHistoryDto,
  ): Promise<LabelPrintHistory> {
    const itemsCount = dto.itemsCount ?? (Array.isArray(dto.items) ? dto.items.length : 0);
    const status =
      dto.status ||
      (dto.action === 'DOWNLOAD_XLSX' ? 'Download XLSX' : 'Print Label');

    const history = this.historyRepository.create({
      ...dto,
      itemsCount,
      status,
      userId,
      companyId,
    });

    return await this.historyRepository.save(history);
  }

  async findAll(
    companyId: string,
    query: {
      page?: number;
      pageSize?: number;
      action?: string;
      search?: string;
    },
  ): Promise<{ items: LabelPrintHistory[]; total: number; page: number; pageSize: number }> {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.max(1, Math.min(100, Number(query.pageSize) || 20));
    const skip = (page - 1) * pageSize;

    const qb = this.historyRepository
      .createQueryBuilder('history')
      .leftJoinAndSelect('history.user', 'user')
      .where('history.companyId = :companyId', { companyId });

    if (query.action && query.action !== 'ALL') {
      qb.andWhere('history.action = :action', { action: query.action });
    }

    if (query.search && query.search.trim()) {
      const searchPattern = `%${query.search.trim().toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(history.status) LIKE :search OR LOWER(user.name) LIKE :search OR LOWER(user.email) LIKE :search OR CAST(history.items AS text) ILIKE :search)',
        { search: searchPattern },
      );
    }

    qb.orderBy('history.createdAt', 'DESC')
      .skip(skip)
      .take(pageSize);

    const [items, total] = await qb.getManyAndCount();

    return {
      items,
      total,
      page,
      pageSize,
    };
  }

  async findOne(companyId: string, id: string): Promise<LabelPrintHistory> {
    const item = await this.historyRepository.findOne({
      where: { id, companyId },
      relations: ['user'],
    });

    if (!item) {
      throw new NotFoundException('Label print history record not found');
    }

    return item;
  }

  async delete(companyId: string, id: string): Promise<{ success: boolean }> {
    const result = await this.historyRepository.delete({ id, companyId });
    if (result.affected === 0) {
      throw new NotFoundException('Label print history record not found');
    }
    return { success: true };
  }
}
