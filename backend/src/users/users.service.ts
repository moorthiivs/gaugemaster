import { ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { User } from './user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateUserDto } from '../dto/create-user.dto';
import * as bcrypt from 'bcryptjs';
import { Company } from 'src/company/entities/company.entity';

@Injectable()
export class UsersService {


  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
  ) { }


  private users: User[] = [];


  async findByEmail(email: string) {
    return this.userRepository.findOne({ where: { email } });
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
      onboarded: false,  // explicitly mark new users as not onboarded
    });



    return this.userRepository.save(user);
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
