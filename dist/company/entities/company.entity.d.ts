import { User } from "src/users/user.entity";
export declare class Company {
    id: string;
    companyName: string;
    companySize: string;
    industry: string;
    registeredUser: User;
    registeredUserId: string;
    registeredEmail: string;
    role: string;
    users: User[];
}
