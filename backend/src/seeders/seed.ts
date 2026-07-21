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

    // 1. Create a default admin user if none exists
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

    // 2. Create a default company if none exists
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

      // 3. Link the admin user to the company
      adminUser.company = defaultCompany;
      adminUser.companyId = defaultCompany.id;
      await userRepository.save(adminUser);
      console.log('✅ Linked admin user to default company');
    }

    console.log('🚀 Seeding completed successfully!');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
  } finally {
    await dataSource.destroy();
  }
}

seed();
