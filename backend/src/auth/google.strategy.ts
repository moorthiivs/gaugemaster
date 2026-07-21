import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
    constructor(configService: ConfigService) {
        const clientID = configService.get<string>('GOOGLE_CLIENT_ID');
        const clientSecret = configService.get<string>('GOOGLE_CLIENT_SECRET');
        const callbackURL = configService.get<string>('GOOGLE_CALLBACK_URL');

        // Use placeholder values when Google credentials are not configured.
        // The strategy won't actually be invoked — the controller/service
        // guards against it — but Passport requires valid constructor args.
        super({
            clientID: clientID || 'not-configured',
            clientSecret: clientSecret || 'not-configured',
            callbackURL: callbackURL || 'http://localhost/not-configured',
            scope: ['email', 'profile'],
        });
    }

    async validate(
        accessToken: string,
        refreshToken: string,
        profile: any,
        done: VerifyCallback,
    ): Promise<any> {
        const { name, emails, id } = profile;
        const user = {
            id,
            email: emails[0].value,
            name: name.givenName + ' ' + name.familyName,
        };
        done(null, user);
    }
}