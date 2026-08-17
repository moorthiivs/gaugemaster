import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn, Index } from "typeorm";
import { v4 as uuidv4 } from "uuid";

@Entity({ name: "location_emails" })
@Index("idx_location_email_company_location", ["companyId", "location"], { unique: true })
export class LocationEmail {
  @PrimaryColumn("uuid")
  id: string = uuidv4();

  @Column({ type: "uuid" })
  companyId: string;

  @Column({ type: "varchar", length: 255 })
  location: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  headName: string;

  @Column({ type: "varchar", length: 255 })
  headEmail: string;

  @Column({ type: "jsonb", default: () => "'[]'", nullable: true })
  managementEmails: string[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
