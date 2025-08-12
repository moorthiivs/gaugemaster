import { Strategy } from 'passport-custom';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
declare const GoogleTokenStrategy_base: new () => Strategy & {
    validate(...args: any[]): unknown;
};
export declare class GoogleTokenStrategy extends GoogleTokenStrategy_base {
    private readonly configService;
    private oauthClient;
    constructor(configService: ConfigService);
    validate(req: Request): Promise<any>;
}
export {};
