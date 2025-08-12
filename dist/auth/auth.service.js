"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const google_auth_library_1 = require("google-auth-library");
const config_1 = require("@nestjs/config");
const users_service_1 = require("../users/users.service");
const bcrypt = __importStar(require("bcryptjs"));
let AuthService = class AuthService {
    jwtService;
    configService;
    usersService;
    oauthClient;
    constructor(jwtService, configService, usersService) {
        this.jwtService = jwtService;
        this.configService = configService;
        this.usersService = usersService;
        this.oauthClient = new google_auth_library_1.OAuth2Client(this.configService.get('GOOGLE_CLIENT_ID'));
    }
    async validateUser(profile) {
        const payload = {
            sub: profile.id,
            email: profile.email,
            name: profile.name,
        };
        return {
            accessToken: this.jwtService.sign(payload),
            user: payload,
        };
    }
    async register(createUserDto) {
        const user = await this.usersService.create(createUserDto);
        const payload = { sub: user.id, email: user.email, name: user.name };
        return {
            accessToken: this.jwtService.sign(payload),
            user: payload,
        };
    }
    async login(loginDto) {
        const { email, password } = loginDto;
        const user = await this.usersService.findByEmail(email);
        if (!user) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        const payload = { sub: user.id, email: user.email, name: user.name };
        return {
            accessToken: this.jwtService.sign(payload),
            user: payload,
        };
    }
    async loginWithGoogleToken(token) {
        const ticket = await this.oauthClient.verifyIdToken({
            idToken: token,
            audience: this.configService.get('GOOGLE_CLIENT_ID'),
        });
        const payload = ticket.getPayload();
        const { sub: googleId, email, name } = payload || {};
        if (!googleId || !email || !name) {
            throw new common_1.UnauthorizedException('Invalid Google token');
        }
        const user = await this.usersService.findOrCreateByGoogleProfile({ id: googleId, email, name });
        const jwtPayload = { sub: user.id, email: user.email, name: user.name };
        return {
            accessToken: this.jwtService.sign(jwtPayload),
            user: jwtPayload,
        };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [jwt_1.JwtService,
        config_1.ConfigService,
        users_service_1.UsersService])
], AuthService);
//# sourceMappingURL=auth.service.js.map