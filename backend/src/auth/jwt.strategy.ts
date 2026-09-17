import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(configService: ConfigService) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: configService.get<string>('JWT_SECRET') || 'gaugemaster',
        });
    }

    async validate(payload: any) {
        return {
            id: payload.sub,
            userId: payload.sub,
            email: payload.email,
            name: payload.name,
            isSuperAdmin: payload.isSuperAdmin || false,
            role: payload.role,
            userRole: payload.userRole,
            companyId: payload.companyId,
            companyAccess: payload.companyAccess,
        };
    }
}
