import { ReportTemplatesService } from './report-templates.service';
export declare class ReportTemplatesController {
    private readonly service;
    constructor(service: ReportTemplatesService);
    create(dto: {
        name: string;
        headerText?: string;
        footerText?: string;
        userId: string;
        companyId?: string;
    }): Promise<import("./entities/report-template.entity").ReportTemplate>;
    findAll(userId: string): Promise<import("./entities/report-template.entity").ReportTemplate[]>;
    findOne(id: string): Promise<import("./entities/report-template.entity").ReportTemplate | null>;
    update(id: string, dto: {
        name?: string;
        headerText?: string;
        footerText?: string;
    }): Promise<import("./entities/report-template.entity").ReportTemplate | null>;
    remove(id: string): Promise<import("./entities/report-template.entity").ReportTemplate>;
}
