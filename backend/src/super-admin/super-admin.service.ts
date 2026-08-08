import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Company } from '../company/entities/company.entity';
import { User } from '../users/user.entity';
import { Instrument } from '../instruments/instrument.entity';
import { CalibrationHistory } from '../instruments/calibration-history.entity';
import { Calibration } from '../calibration/calibration.entity';
import { CalibrationAuditLog } from '../calibration/calibration-audit-log.entity';
import { CalibrationDraft } from '../calibration/calibration-draft.entity';
import { CalibrationTemplate } from '../calibration-templates/entities/calibration-template.entity';
import { TemplateAuditLog } from '../calibration-templates/entities/template-audit-log.entity';
import { Role } from '../roles/role.entity';
import { Setting } from '../settings/entities/setting.entity';
import { Notification } from '../notifications/notification.entity';
import { ReminderFrequncy } from '../reminder/reminder.entity';
import { UpdateCompanyAccessDto, UpdateCompanyDto } from './dto/super-admin.dto';

@Injectable()
export class SuperAdminService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Instrument)
    private readonly instrumentRepository: Repository<Instrument>,
    @InjectRepository(Calibration)
    private readonly calibrationRepository: Repository<Calibration>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
  ) {}

  async listCompanies() {
    const companies = await this.companyRepository.find({
      order: { createdAt: 'DESC' },
    });

    const result: any[] = [];
    for (const company of companies) {
      const userCount = await this.userRepository.count({ where: { companyId: company.id } });
      const instrumentCount = await this.instrumentRepository.count({ where: { companyId: company.id } });
      const calibrationCount = await this.calibrationRepository.count({ where: { companyId: company.id } });

      result.push({
        id: company.id,
        companyName: company.companyName,
        companySize: company.companySize,
        industry: company.industry,
        registeredEmail: company.registeredEmail,
        role: company.role,
        accessStatus: company.accessStatus || 'enabled',
        accessStartDate: company.accessStartDate,
        accessExpiryDate: company.accessExpiryDate,
        createdAt: company.createdAt,
        updatedAt: company.updatedAt,
        userCount,
        instrumentCount,
        calibrationCount,
      });
    }

    return result;
  }

  async getCompanyDetails(companyId: string) {
    const company = await this.companyRepository.findOne({ where: { id: companyId } });
    if (!company) {
      throw new NotFoundException(`Company with ID ${companyId} not found`);
    }

    const users = await this.userRepository.find({
      where: { companyId },
      relations: ['role'],
      order: { createdAt: 'DESC' },
      select: ['id', 'name', 'email', 'roleId', 'designation', 'createdAt', 'updatedAt', 'onboarded'],
    });

    const instrumentCount = await this.instrumentRepository.count({ where: { companyId } });
    const calibrationCount = await this.calibrationRepository.count({ where: { companyId } });
    const roleCount = await this.roleRepository.count({ where: { companyId } });

    return {
      ...company,
      users,
      stats: {
        userCount: users.length,
        instrumentCount,
        calibrationCount,
        roleCount,
      },
    };
  }

  async updateCompany(companyId: string, dto: UpdateCompanyDto) {
    const company = await this.companyRepository.findOne({ where: { id: companyId } });
    if (!company) {
      throw new NotFoundException(`Company with ID ${companyId} not found`);
    }

    if (dto.companyName !== undefined) company.companyName = dto.companyName;
    if (dto.industry !== undefined) company.industry = dto.industry;
    if (dto.companySize !== undefined) company.companySize = dto.companySize;

    return this.companyRepository.save(company);
  }

  async updateAccess(companyId: string, dto: UpdateCompanyAccessDto) {
    const company = await this.companyRepository.findOne({ where: { id: companyId } });
    if (!company) {
      throw new NotFoundException(`Company with ID ${companyId} not found`);
    }

    company.accessStatus = dto.accessStatus;

    if (dto.accessStatus === 'time_limited') {
      if (!dto.accessStartDate || !dto.accessExpiryDate) {
        throw new BadRequestException('Start date and expiry date are required for time-limited access');
      }
      company.accessStartDate = new Date(dto.accessStartDate);
      company.accessExpiryDate = new Date(dto.accessExpiryDate);
    } else {
      company.accessStartDate = null as any;
      company.accessExpiryDate = null as any;
    }

    return this.companyRepository.save(company);
  }

  async getCompanyStats(companyId: string) {
    const company = await this.companyRepository.findOne({ where: { id: companyId } });
    if (!company) {
      throw new NotFoundException(`Company with ID ${companyId} not found`);
    }

    // Get user IDs for this company
    const users = await this.userRepository.find({
      where: { companyId },
      select: ['id'],
    });
    const userIds = users.map(u => u.id);

    const instrumentCount = await this.instrumentRepository.count({ where: { companyId } });
    const calibrationCount = await this.calibrationRepository.count({ where: { companyId } });
    const roleCount = await this.roleRepository.count({ where: { companyId } });

    return {
      companyId,
      companyName: company.companyName,
      userCount: users.length,
      instrumentCount,
      calibrationCount,
      roleCount,
    };
  }

  async deleteCompany(companyId: string, confirmationName: string) {
    const company = await this.companyRepository.findOne({ where: { id: companyId } });
    if (!company) {
      throw new NotFoundException(`Company with ID ${companyId} not found`);
    }

    // Validate confirmation name
    if (company.companyName.trim().toLowerCase() !== confirmationName.trim().toLowerCase()) {
      throw new BadRequestException('Company name confirmation does not match. Deletion aborted.');
    }

    // Get all user IDs for this company
    const users = await this.userRepository.find({
      where: { companyId },
      select: ['id'],
    });
    const userIds = users.map(u => u.id);

    const deleteSummary: Record<string, number> = {};

    await this.dataSource.transaction(async (manager) => {
      // 1. Calibration audit logs (FK → calibrations)
      const calAuditResult = await manager
        .createQueryBuilder()
        .delete()
        .from('calibration_audit_logs')
        .where('"calibration_id" IN (SELECT id FROM calibrations WHERE "companyId" = :companyId)', { companyId })
        .execute();
      deleteSummary['calibration_audit_logs'] = calAuditResult.affected || 0;

      // 2. Calibrations
      const calibrationResult = await manager
        .createQueryBuilder()
        .delete()
        .from('calibrations')
        .where('"companyId" = :companyId', { companyId })
        .execute();
      deleteSummary['calibrations'] = calibrationResult.affected || 0;

      // 3. Calibration drafts (FK → users)
      if (userIds.length > 0) {
        const draftResult = await manager
          .createQueryBuilder()
          .delete()
          .from('calibration_drafts')
          .where('"user_id" IN (:...userIds)', { userIds })
          .execute();
        deleteSummary['calibration_drafts'] = draftResult.affected || 0;
      }

      // 4. Calibration history (FK → instruments)
      const historyResult = await manager
        .createQueryBuilder()
        .delete()
        .from('calibration_history')
        .where('"instrument_id" IN (SELECT id FROM instruments WHERE "companyId" = :companyId)', { companyId })
        .execute();
      deleteSummary['calibration_history'] = historyResult.affected || 0;

      // 5. Template audit logs (sourceCompanyId / destinationCompanyId)
      const templateAuditResult = await manager
        .createQueryBuilder()
        .delete()
        .from('template_audit_logs')
        .where('"sourceCompanyId" = :companyId OR "destinationCompanyId" = :companyId', { companyId })
        .execute();
      deleteSummary['template_audit_logs'] = templateAuditResult.affected || 0;

      // 6. Calibration templates
      const templateResult = await manager
        .createQueryBuilder()
        .delete()
        .from('calibration_templates')
        .where('"companyId" = :companyId', { companyId })
        .execute();
      deleteSummary['calibration_templates'] = templateResult.affected || 0;

      // 7. Instruments
      const instrumentResult = await manager
        .createQueryBuilder()
        .delete()
        .from('instruments')
        .where('"companyId" = :companyId', { companyId })
        .execute();
      deleteSummary['instruments'] = instrumentResult.affected || 0;

      // 8. Notifications
      const notifResult = await manager
        .createQueryBuilder()
        .delete()
        .from('notifications')
        .where('"companyId" = :companyId', { companyId })
        .execute();
      deleteSummary['notifications'] = notifResult.affected || 0;

      // 9. Settings
      const settingsResult = await manager
        .createQueryBuilder()
        .delete()
        .from('settings')
        .where('"companyId" = :companyId', { companyId })
        .execute();
      deleteSummary['settings'] = settingsResult.affected || 0;

      // 10. Reminder Frequency
      const reminderResult = await manager
        .createQueryBuilder()
        .delete()
        .from('ReminderFrequncy')
        .where('"companyId" = :companyId', { companyId })
        .execute();
      deleteSummary['reminders'] = reminderResult.affected || 0;

      // 11. Upload jobs
      const uploadResult = await manager
        .createQueryBuilder()
        .delete()
        .from('upload_jobs')
        .where('"companyId" = :companyId', { companyId })
        .execute();
      deleteSummary['upload_jobs'] = uploadResult.affected || 0;

      // 12. Backup schedules
      const backupSchedResult = await manager
        .createQueryBuilder()
        .delete()
        .from('backup_schedules')
        .where('"companyId" = :companyId', { companyId })
        .execute();
      deleteSummary['backup_schedules'] = backupSchedResult.affected || 0;

      // 13. Roles
      const rolesResult = await manager
        .createQueryBuilder()
        .delete()
        .from('roles')
        .where('"companyId" = :companyId', { companyId })
        .execute();
      deleteSummary['roles'] = rolesResult.affected || 0;

      // 14. Users
      const usersResult = await manager
        .createQueryBuilder()
        .delete()
        .from('users')
        .where('"companyId" = :companyId', { companyId })
        .execute();
      deleteSummary['users'] = usersResult.affected || 0;

      // 15. Company itself
      await manager
        .createQueryBuilder()
        .delete()
        .from('companies')
        .where('id = :companyId', { companyId })
        .execute();
      deleteSummary['companies'] = 1;
    });

    return {
      message: `Company "${company.companyName}" and all associated data deleted successfully.`,
      deleteSummary,
    };
  }
}
