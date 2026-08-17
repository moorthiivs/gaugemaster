import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThan, MoreThan } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Instrument } from '../instruments/instrument.entity';
import { CalibrationHistory } from '../instruments/calibration-history.entity';
import { LocationEmail } from '../settings/entities/location-email.entity';
import { Setting } from '../settings/entities/setting.entity';
import { MailerService } from '../mail/mailer.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class SummaryReportService {
  private readonly logger = new Logger(SummaryReportService.name);

  constructor(
    @InjectRepository(Instrument)
    private readonly instrumentRepository: Repository<Instrument>,
    @InjectRepository(CalibrationHistory)
    private readonly calibrationHistoryRepository: Repository<CalibrationHistory>,
    @InjectRepository(LocationEmail)
    private readonly locationEmailRepository: Repository<LocationEmail>,
    @InjectRepository(Setting)
    private readonly settingRepository: Repository<Setting>,
    private readonly mailerService: MailerService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Daily Cron at 9:30 AM to send management summary reports
   */
  @Cron('30 9 * * *')
  async runDailySummaryReports() {
    this.logger.log('🕒 Running daily automated management summary reports...');
    try {
      await this.generateAndSendSummaries();
    } catch (err) {
      this.logger.error(`Error in automated summary reports: ${err.message}`, err.stack);
    }
  }

  async generateAndSendSummaries() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);

    // Group location emails by company
    const allLocations = await this.locationEmailRepository.find();
    const settings = await this.settingRepository.find();
    const settingsMap = new Map<string, Setting>();
    settings.forEach((s) => {
      if (s.companyId) settingsMap.set(s.companyId, s);
    });

    // 1. Send Location-specific Summary Reports
    for (const loc of allLocations) {
      const managementEmails = (loc.managementEmails || []).filter(Boolean);
      if (managementEmails.length === 0) continue;

      const setting = settingsMap.get(loc.companyId);
      const thresholdDays = setting?.dueReminderThresholdDays || 15;

      const dueEndDate = new Date(today);
      dueEndDate.setDate(today.getDate() + thresholdDays);
      dueEndDate.setHours(23, 59, 59, 999);

      // Query counts for this location
      const totalInstruments = await this.instrumentRepository.count({
        where: { companyId: loc.companyId, location: loc.location },
      });

      // Due soon
      const dueSoonCount = await this.instrumentRepository
        .createQueryBuilder('i')
        .where('i.companyId = :companyId', { companyId: loc.companyId })
        .andWhere('i.location = :location', { location: loc.location })
        .andWhere('i.due_date BETWEEN :today AND :dueEndDate', { today, dueEndDate })
        .andWhere('LOWER(TRIM(COALESCE(i.status, \'\'))) != :sentStatus', { sentStatus: 'sent for calibration' })
        .getCount();

      // Ongoing calibration
      const ongoingCount = await this.instrumentRepository
        .createQueryBuilder('i')
        .where('i.companyId = :companyId', { companyId: loc.companyId })
        .andWhere('i.location = :location', { location: loc.location })
        .andWhere('LOWER(TRIM(COALESCE(i.status, \'\'))) = :sentStatus', { sentStatus: 'sent for calibration' })
        .getCount();

      // Overdue
      const overdueCount = await this.instrumentRepository
        .createQueryBuilder('i')
        .where('i.companyId = :companyId', { companyId: loc.companyId })
        .andWhere('i.location = :location', { location: loc.location })
        .andWhere('i.due_date < :today', { today })
        .andWhere('LOWER(TRIM(COALESCE(i.status, \'\'))) != :sentStatus', { sentStatus: 'sent for calibration' })
        .getCount();

      // Completed in last 30 days
      const completedCount = await this.calibrationHistoryRepository
        .createQueryBuilder('h')
        .innerJoin('h.instrument', 'i')
        .where('i.companyId = :companyId', { companyId: loc.companyId })
        .andWhere('i.location = :location', { location: loc.location })
        .andWhere('h.created_at >= :thirtyDaysAgo', { thirtyDaysAgo })
        .getCount();

      const html = this.buildSummaryEmailHtml({
        title: `Management Calibration Summary: ${loc.location}`,
        subtitle: `Location: ${loc.location} | Head: ${loc.headName || 'N/A'} (${loc.headEmail || 'N/A'})`,
        totalInstruments,
        dueSoonCount,
        ongoingCount,
        completedCount,
        overdueCount,
        thresholdDays,
      });

      const subject = `[GaugeMaster Summary] Calibration Status Report — ${loc.location}`;

      try {
        await this.mailerService.sendMail({
          to: managementEmails,
          subject,
          html,
          companyId: loc.companyId,
        });

        this.logger.log(`📧 Summary report sent to ${managementEmails.join(', ')} for location ${loc.location}`);
      } catch (err) {
        this.logger.error(`Failed to send summary report for ${loc.location}: ${err.message}`);
      }
    }

    // 2. Company-level Summary if company management recipients configured
    for (const setting of settings) {
      const cfg = setting.summaryReportConfig;
      if (!cfg || !cfg.enabled || !(cfg.managementRecipients || []).length) continue;

      const thresholdDays = setting.dueReminderThresholdDays || 15;
      const dueEndDate = new Date(today);
      dueEndDate.setDate(today.getDate() + thresholdDays);

      const totalInstruments = await this.instrumentRepository.count({
        where: { companyId: setting.companyId },
      });

      const dueSoonCount = await this.instrumentRepository
        .createQueryBuilder('i')
        .where('i.companyId = :companyId', { companyId: setting.companyId })
        .andWhere('i.due_date BETWEEN :today AND :dueEndDate', { today, dueEndDate })
        .andWhere('LOWER(TRIM(COALESCE(i.status, \'\'))) != :sentStatus', { sentStatus: 'sent for calibration' })
        .getCount();

      const ongoingCount = await this.instrumentRepository
        .createQueryBuilder('i')
        .where('i.companyId = :companyId', { companyId: setting.companyId })
        .andWhere('LOWER(TRIM(COALESCE(i.status, \'\'))) = :sentStatus', { sentStatus: 'sent for calibration' })
        .getCount();

      const overdueCount = await this.instrumentRepository
        .createQueryBuilder('i')
        .where('i.companyId = :companyId', { companyId: setting.companyId })
        .andWhere('i.due_date < :today', { today })
        .andWhere('LOWER(TRIM(COALESCE(i.status, \'\'))) != :sentStatus', { sentStatus: 'sent for calibration' })
        .getCount();

      const completedCount = await this.calibrationHistoryRepository
        .createQueryBuilder('h')
        .innerJoin('h.instrument', 'i')
        .where('i.companyId = :companyId', { companyId: setting.companyId })
        .andWhere('h.created_at >= :thirtyDaysAgo', { thirtyDaysAgo })
        .getCount();

      const html = this.buildSummaryEmailHtml({
        title: 'Executive Calibration Summary Report',
        subtitle: `Company Total Overview — Date: ${today.toLocaleDateString()}`,
        totalInstruments,
        dueSoonCount,
        ongoingCount,
        completedCount,
        overdueCount,
        thresholdDays,
      });

      try {
        await this.mailerService.sendMail({
          to: cfg.managementRecipients || [],
          subject: `[Executive Summary] Calibration Metrics Overview`,
          html,
          companyId: setting.companyId,
        });
        this.logger.log(`📧 Company executive summary sent for company ${setting.companyId}`);
      } catch (e) {
        this.logger.error(`Failed to send company executive summary: ${e.message}`);
      }
    }
  }

  private buildSummaryEmailHtml(data: {
    title: string;
    subtitle: string;
    totalInstruments: number;
    dueSoonCount: number;
    ongoingCount: number;
    completedCount: number;
    overdueCount: number;
    thresholdDays: number;
  }): string {
    return `
      <div style="font-family:Arial, sans-serif; color:#333; max-width:680px; margin:0 auto; padding:24px; border:1px solid #e2e8f0; border-radius:10px; background:#fafafa;">
        <div style="text-align:center; padding-bottom:16px; border-bottom:2px solid #2563eb;">
          <h2 style="color:#1e3a8a; margin:0 0 6px 0;">${data.title}</h2>
          <p style="color:#64748b; margin:0; font-size:14px;">${data.subtitle}</p>
        </div>

        <div style="margin-top:20px;">
          <table style="width:100%; border-collapse:separate; border-spacing:10px;">
            <tr>
              <td style="background:#ffffff; border:1px solid #e2e8f0; border-radius:8px; padding:16px; text-align:center; width:50%;">
                <div style="font-size:12px; font-weight:bold; color:#64748b; text-transform:uppercase;">Total Instruments</div>
                <div style="font-size:28px; font-weight:bold; color:#1e293b; margin-top:4px;">${data.totalInstruments}</div>
              </td>
              <td style="background:#ffffff; border:1px solid #fed7aa; border-radius:8px; padding:16px; text-align:center; width:50%;">
                <div style="font-size:12px; font-weight:bold; color:#d97706; text-transform:uppercase;">Due Within ${data.thresholdDays} Days</div>
                <div style="font-size:28px; font-weight:bold; color:#d97706; margin-top:4px;">${data.dueSoonCount}</div>
              </td>
            </tr>
            <tr>
              <td style="background:#ffffff; border:1px solid #c7d2fe; border-radius:8px; padding:16px; text-align:center; width:50%;">
                <div style="font-size:12px; font-weight:bold; color:#4f46e5; text-transform:uppercase;">Ongoing Calibration</div>
                <div style="font-size:28px; font-weight:bold; color:#4f46e5; margin-top:4px;">${data.ongoingCount}</div>
              </td>
              <td style="background:#ffffff; border:1px solid #bbf7d0; border-radius:8px; padding:16px; text-align:center; width:50%;">
                <div style="font-size:12px; font-weight:bold; color:#16a34a; text-transform:uppercase;">Completed (Last 30 Days)</div>
                <div style="font-size:28px; font-weight:bold; color:#16a34a; margin-top:4px;">${data.completedCount}</div>
              </td>
            </tr>
            ${
              data.overdueCount > 0
                ? `
            <tr>
              <td colspan="2" style="background:#fef2f2; border:1px solid #fecaca; border-radius:8px; padding:12px; text-align:center;">
                <span style="font-size:13px; font-weight:bold; color:#dc2626;">⚠️ Attention Required: ${data.overdueCount} instrument(s) are currently OVERDUE for calibration.</span>
              </td>
            </tr>`
                : ''
            }
          </table>
        </div>

        <div style="margin-top:20px; text-align:center; font-size:12px; color:#94a3b8; border-top:1px solid #e2e8f0; padding-top:12px;">
          Generated automatically by GaugeMaster Calibration Management System
        </div>
      </div>
    `;
  }
}
