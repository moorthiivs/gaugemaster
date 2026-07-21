import { Company } from '../company/entities/company.entity';
export declare class User {
    id: string;
    email: string;
    name: string;
    password: string;
    googleId: string;
    createdAt: Date;
    updatedAt: Date;
    company: Company;
    companyId: string;
    onboarded: boolean;
}
