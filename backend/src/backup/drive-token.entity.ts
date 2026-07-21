import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

@Entity('drive_tokens')
export class DriveToken {
    @PrimaryColumn('uuid')
    id: string = uuidv4();

    @Column({ unique: true })
    companyId: string;

    @Column({ type: 'text' })
    refreshToken: string;

    @Column({ type: 'text', nullable: true })
    accessToken: string;

    @Column({ nullable: true })
    email: string; // Google account email for display

    @Column({ nullable: true })
    folderId: string; // Google Drive folder ID where backups are stored

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
