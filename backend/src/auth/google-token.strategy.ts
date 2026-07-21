// google-token.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import { Request } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleTokenStrategy extends PassportStrategy(Strategy, 'google-token') {
    private oauthClient: OAuth2Client | null = null;
    private readonly googleEnabled: boolean;

    constructor(private readonly configService: ConfigService) {
        super();
        const clientId = this.configService.get('GOOGLE_CLIENT_ID');
        this.googleEnabled = !!clientId;
        if (this.googleEnabled) {
            this.oauthClient = new OAuth2Client(clientId);
        }
    }

    async validate(req: Request): Promise<any> {
        if (!this.googleEnabled || !this.oauthClient) {
            throw new Error('Google authentication is not configured');
        }

        const token = req.body.token;

        if (!token) throw new Error('No token provided');

        const ticket = await this.oauthClient.verifyIdToken({
            idToken: token,
            audience: this.configService.get('GOOGLE_CLIENT_ID'),
        });

        const payload = ticket.getPayload();
        const { sub: id, email, name } = payload || {};

        return { id, email, name };
    }
}
