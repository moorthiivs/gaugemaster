import { MigrationInterface, QueryRunner } from "typeorm";
export declare class InitialSchema1779257576986 implements MigrationInterface {
    name: string;
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
}
