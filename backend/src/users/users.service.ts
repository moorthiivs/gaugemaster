import { ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { User } from './user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateUserDto } from '../dto/create-user.dto';
import * as bcrypt from 'bcryptjs';
import { Company } from 'src/company/entities/company.entity';

import { Role } from '../roles/role.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
  ) {}

  async findAll(companyId?: string): Promise<User[]> {
    const query = this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .leftJoinAndSelect('user.company', 'company')
      .orderBy('user.createdAt', 'DESC');

    if (companyId) {
      query.where('user.companyId = :companyId', { companyId });
    }

    return query.getMany();
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['role', 'company'],
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async findByEmail(email: string) {
    const user = await this.userRepository.findOne({
      where: { email },
      relations: ['role', 'company'],
    });

    if (user && user.companyId && !user.roleId) {
      const adminRole = await this.roleRepository.findOne({
        where: [{ companyId: user.companyId, name: 'Admin' }, { name: 'Admin', isSystemDefault: true }],
      });
      if (adminRole) {
        user.roleId = adminRole.id;
        user.role = adminRole;
        await this.userRepository.update(user.id, { roleId: adminRole.id });
      }
    }

    return user;
  }

  async create(createUserDto: CreateUserDto): Promise<User> {
    const existingUser = await this.findByEmail(createUserDto.email);
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    const user = this.userRepository.create({
      name: createUserDto.name,
      email: createUserDto.email,
      password: hashedPassword,
      onboarded: false,
    });

    return this.userRepository.save(user);
  }

  async createUser(data: {
    name: string;
    email: string;
    password?: string;
    roleId?: string;
    designation?: string;
    signature?: string;
    additionalEmails?: string[];
    companyId?: string;
  }): Promise<User> {
    const existingUser = await this.findByEmail(data.email);
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    let targetCompanyId = data.companyId;
    if (!targetCompanyId) {
      const firstCompany = await this.companyRepository.findOne({ where: {} });
      if (firstCompany) {
        targetCompanyId = firstCompany.id;
      }
    }

    let assignedRole: Role | undefined = undefined;
    let targetRoleId = data.roleId;
    if (targetRoleId) {
      const foundRole = await this.roleRepository.findOne({
        where: [{ id: targetRoleId }, { name: targetRoleId }],
      });
      if (foundRole) {
        assignedRole = foundRole;
        targetRoleId = foundRole.id;
      }
    }

    const hashedPassword = data.password
      ? await bcrypt.hash(data.password, 10)
      : await bcrypt.hash('Password123!', 10);

    const user = this.userRepository.create({
      name: data.name,
      email: data.email,
      password: hashedPassword,
      roleId: targetRoleId || undefined,
      role: assignedRole,
      designation: data.designation,
      signature: data.signature,
      additionalEmails: data.additionalEmails || [],
      companyId: targetCompanyId,
      onboarded: true,
    });

    return this.userRepository.save(user);
  }

  async updateUser(
    id: string,
    data: {
      name?: string;
      email?: string;
      password?: string;
      roleId?: string;
      designation?: string;
      signature?: string;
      additionalEmails?: string[];
      companyId?: string;
    },
  ): Promise<User> {
    const user = await this.findOne(id);

    if (data.email && data.email !== user.email) {
      const existing = await this.findByEmail(data.email);
      if (existing) {
        throw new ConflictException('Email already in use');
      }
      user.email = data.email;
    }

    if (data.name) user.name = data.name;
    if (data.designation !== undefined) user.designation = data.designation;
    if (data.signature !== undefined) user.signature = data.signature;
    if (data.additionalEmails !== undefined) user.additionalEmails = data.additionalEmails;
    if (data.companyId) user.companyId = data.companyId;

    if (data.roleId !== undefined && data.roleId !== '') {
      const foundRole = await this.roleRepository.findOne({
        where: [{ id: data.roleId }, { name: data.roleId }],
      });
      if (foundRole) {
        user.roleId = foundRole.id;
        user.role = foundRole;
      } else {
        user.roleId = data.roleId;
      }
    }

    if (data.password && data.password.trim() !== '') {
      user.password = await bcrypt.hash(data.password, 10);
    }

    await this.userRepository.save(user);
    return this.findOne(id);
  }

  async removeUser(id: string): Promise<void> {
    const user = await this.findOne(id);
    await this.userRepository.remove(user);
  }

  async findOrCreateByGoogleProfile(profile: { id: string; email: string; name: string }): Promise<User> {
    let user = await this.userRepository.findOne({ where: { email: profile.email } });

    if (!user) {
      user = this.userRepository.create({
        email: profile.email,
        name: profile.name,
        googleId: profile.id,
        onboarded: false,
      });
      await this.userRepository.save(user);
    }

    return user;
  }

  async updateCompany(companyId: string, userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const company = await this.companyRepository.findOne({ where: { id: companyId } });
    if (!company) {
      throw new NotFoundException('Company not found');
    }

    user.companyId = companyId;
    user.onboarded = true;

    await this.userRepository.save(user);

    return {
      message: 'Company updated successfully for user',
      user,
    };
  }
}
