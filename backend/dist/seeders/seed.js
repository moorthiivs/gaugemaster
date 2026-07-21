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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ormconfig_1 = __importDefault(require("../ormconfig"));
const user_entity_1 = require("../users/user.entity");
const company_entity_1 = require("../company/entities/company.entity");
const bcrypt = __importStar(require("bcryptjs"));
async function seed() {
    console.log('🌱 Starting database seeding...');
    const dataSource = await ormconfig_1.default.initialize();
    try {
        const userRepository = dataSource.getRepository(user_entity_1.User);
        const companyRepository = dataSource.getRepository(company_entity_1.Company);
        const adminEmail = 'admin@gaugemaster.com';
        let adminUser = await userRepository.findOne({ where: { email: adminEmail } });
        if (!adminUser) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            adminUser = userRepository.create({
                name: 'Administrator',
                email: adminEmail,
                password: hashedPassword,
                onboarded: true
            });
            adminUser = await userRepository.save(adminUser);
            console.log('✅ Default admin user created (admin@gaugemaster.com / admin123)');
        }
        let defaultCompany = await companyRepository.findOne({ where: { companyName: 'Gaugemaster Default' } });
        if (!defaultCompany) {
            defaultCompany = companyRepository.create({
                companyName: 'Gaugemaster Default',
                registeredEmail: 'info@gaugemaster.com',
                role: 'admin',
                registeredUserId: adminUser.id
            });
            defaultCompany = await companyRepository.save(defaultCompany);
            console.log('✅ Default company created');
            adminUser.company = defaultCompany;
            adminUser.companyId = defaultCompany.id;
            await userRepository.save(adminUser);
            console.log('✅ Linked admin user to default company');
        }
        console.log('🚀 Seeding completed successfully!');
    }
    catch (error) {
        console.error('❌ Seeding failed:', error);
    }
    finally {
        await dataSource.destroy();
    }
}
seed();
//# sourceMappingURL=seed.js.map