import { Repository } from 'typeorm';
import { ReportTemplate } from './entities/report-template.entity';
export declare class ReportTemplatesService {
    private readonly repository;
    constructor(repository: Repository<ReportTemplate>);
    create(dto: {
        name: string;
        headerText?: string;
        footerText?: string;
        userId: string;
        companyId?: string;
    }): Promise<ReportTemplate>;
    findAll(userId: string): Promise<ReportTemplate[]>;
    findOne(id: string): Promise<ReportTemplate | null>;
    update(id: string, dto: {
        name?: string;
        headerText?: string;
        footerText?: string;
    }): Promise<ReportTemplate | null>;
    remove(id: string): Promise<ReportTemplate>;
}
