import ormconfig from '../ormconfig';
import { User } from '../users/user.entity';
import { Company } from '../company/entities/company.entity';
import * as bcrypt from 'bcryptjs';

async function seed() {
  console.log('🌱 Starting database seeding...');
  
  const dataSource = await ormconfig.initialize();
  
  try {
    const userRepository = dataSource.getRepository(User);
    const companyRepository = dataSource.getRepository(Company);

    // 1. Super Admin is the primary platform authority (independent of any company)
    const superAdminEmail = 'superadmin@gaugemaster.com';
    let superAdmin = await userRepository.findOne({ where: { email: superAdminEmail } });
    if (!superAdmin) {
      const hashedPassword = await bcrypt.hash('Admin@123', 10);
      superAdmin = userRepository.create({
        name: 'Super Admin',
        email: superAdminEmail,
        password: hashedPassword,
        isSuperAdmin: true,
        onboarded: true,
        companyId: null as any,
      });
      await userRepository.save(superAdmin);
      console.log('✅ Super Admin created as global platform authority (superadmin@gaugemaster.com / Admin@123)');
    } else {
      let needsSave = false;
      if (!superAdmin.isSuperAdmin) {
        superAdmin.isSuperAdmin = true;
        needsSave = true;
      }
      if (superAdmin.companyId !== null) {
        superAdmin.companyId = null as any;
        needsSave = true;
      }
      if (needsSave) {
        await userRepository.save(superAdmin);
        console.log('✅ Super Admin updated and decoupled from companyId');
      } else {
        console.log('ℹ️ Super Admin verified and is unattached to any company');
      }
    }

    // 2. Only bootstrap a default company and admin if NO companies exist at all
    const existingCompaniesCount = await companyRepository.count();
    if (existingCompaniesCount === 0) {
      console.log('ℹ️ No companies found in system. Creating initial default company and admin...');
      const adminEmail = 'admin@gaugemaster.com';
      let adminUser = await userRepository.findOne({ where: { email: adminEmail } });
      if (!adminUser) {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        adminUser = userRepository.create({
          name: 'Administrator',
          email: adminEmail,
          password: hashedPassword,
          onboarded: true,
          isSuperAdmin: false,
        });
        adminUser = await userRepository.save(adminUser);
        console.log('✅ Default company admin created (admin@gaugemaster.com / admin123)');
      }

      const defaultCompany = companyRepository.create({
        companyName: 'Gaugemaster Default',
        registeredEmail: 'info@gaugemaster.com',
        role: 'admin',
        registeredUserId: adminUser.id,
        accessStatus: 'enabled',
      });
      const savedCompany = await companyRepository.save(defaultCompany);
      console.log('✅ Default company created');

      adminUser.company = savedCompany;
      adminUser.companyId = savedCompany.id;
      await userRepository.save(adminUser);
      console.log('✅ Linked default company admin to company');
    } else {
      console.log(`ℹ️ System already has ${existingCompaniesCount} company/companies. Skipping default company creation.`);
    }

    console.log('🚀 Seeding completed successfully!');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
  } finally {
    await dataSource.destroy();
  }
}

seed();
