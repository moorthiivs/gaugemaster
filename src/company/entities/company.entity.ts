
import { User } from "src/users/user.entity";
import { Entity, Column, ManyToOne, JoinColumn, PrimaryColumn, OneToMany } from "typeorm";
import { v4 as uuidv4 } from 'uuid';

@Entity({ name: "companies" })
export class Company {
    @PrimaryColumn('uuid')
    id: string = uuidv4();

    @Column({ type: "varchar", length: 255 })
    companyName: string;

    @Column({ type: "varchar", length: 50, nullable: true })
    companySize: string;

    @Column({ type: "varchar", length: 100, nullable: true })
    industry: string;

    @ManyToOne(() => User, (user) => user.company, { onDelete: "CASCADE" })
    @JoinColumn({ name: "registeredUserId" })
    registeredUser: User;

    @Column()
    registeredUserId: string;

    @Column({ type: "varchar", length: 255, unique: true })
    registeredEmail: string;

    @Column({ type: "varchar", length: 50 })
    role: string;

    @OneToMany(() => User, (user) => user.company)
    users: User[];
}
