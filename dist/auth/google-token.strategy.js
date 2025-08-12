"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleTokenStrategy = void 0;
const common_1 = require("@nestjs/common");
const passport_1 = require("@nestjs/passport");
const passport_custom_1 = require("passport-custom");
const google_auth_library_1 = require("google-auth-library");
const config_1 = require("@nestjs/config");
let GoogleTokenStrategy = class GoogleTokenStrategy extends (0, passport_1.PassportStrategy)(passport_custom_1.Strategy, 'google-token') {
    configService;
    oauthClient;
    constructor(configService) {
        super();
        this.configService = configService;
        this.oauthClient = new google_auth_library_1.OAuth2Client(this.configService.get('GOOGLE_CLIENT_ID'));
    }
    async validate(req) {
        const token = req.body.token;
        if (!token)
            throw new Error('No token provided');
        const ticket = await this.oauthClient.verifyIdToken({
            idToken: token,
            audience: this.configService.get('GOOGLE_CLIENT_ID'),
        });
        const payload = ticket.getPayload();
        const { sub: id, email, name } = payload || {};
        return { id, email, name };
    }
};
exports.GoogleTokenStrategy = GoogleTokenStrategy;
exports.GoogleTokenStrategy = GoogleTokenStrategy = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], GoogleTokenStrategy);
//# sourceMappingURL=google-token.strategy.js.map