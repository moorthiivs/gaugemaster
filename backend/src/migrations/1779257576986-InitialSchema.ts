import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1779257576986 implements MigrationInterface {
    name = 'InitialSchema1779257576986'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "upload_jobs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "companyId" uuid NOT NULL, "fileName" character varying NOT NULL, "status" character varying NOT NULL DEFAULT 'pending', "totalRows" integer NOT NULL DEFAULT '0', "processedRows" integer NOT NULL DEFAULT '0', "successCount" integer NOT NULL DEFAULT '0', "failedCount" integer NOT NULL DEFAULT '0', "errors" jsonb NOT NULL DEFAULT '[]', "createdBy" uuid, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_34cc4b2ed56792958d2b85650a1" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "drive_tokens" ("id" uuid NOT NULL, "companyId" character varying NOT NULL, "refreshToken" text NOT NULL, "accessToken" text, "email" character varying, "folderId" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_4f13dd547a48b1de5ca4b17a0f1" UNIQUE ("companyId"), CONSTRAINT "PK_1e6897700bd8a65903c70c8e919" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "backup_records" ("id" uuid NOT NULL, "companyId" character varying NOT NULL, "triggeredBy" character varying, "type" character varying(20) NOT NULL, "status" character varying(20) NOT NULL, "fileName" character varying, "fileSizeBytes" bigint, "storageType" character varying(50) NOT NULL DEFAULT 'local', "storagePath" character varying, "errorMessage" character varying, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "completedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_13c40e36547fe8bc4903891715b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "backup_schedules" ("id" uuid NOT NULL, "companyId" character varying NOT NULL, "enabled" boolean NOT NULL DEFAULT true, "frequency" character varying(20) NOT NULL, "timeOfDay" character varying(10) NOT NULL DEFAULT '02:00', "dayOfWeek" integer, "dayOfMonth" integer, "retentionDays" integer NOT NULL DEFAULT '7', "storageType" character varying(50) NOT NULL DEFAULT 'local', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_14429218ef83c8eae127050e2fa" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "backup_schedules"`);
        await queryRunner.query(`DROP TABLE "backup_records"`);
        await queryRunner.query(`DROP TABLE "drive_tokens"`);
        await queryRunner.query(`DROP TABLE "upload_jobs"`);
    }

}
