import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThan, Not, In } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Instrument } from '../instruments/instrument.entity';
import { LocationEmail } from '../settings/entities/location-email.entity';
import { Setting } from '../settings/entities/setting.entity';
import { MailerService } from '../mail/mailer.service';
import { NotificationsService } from '../notifications/notifications.service';

function escapeHtml(str: any): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

@Injectable()
export class StatusNotificationService {
  private readonly logger = new Logger(StatusNotificationService.name);

  constructor(
    @InjectRepository(Instrument)
    private readonly instrumentRepository: Repository<Instrument>,
    @InjectRepository(LocationEmail)
    private readonly locationEmailRepository: Repository<LocationEmail>,
    @InjectRepository(Setting)
    private readonly settingRepository: Repository<Setting>,
    private readonly mailerService: MailerService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Daily Cron at 9:00 AM to process:
   * 1. 15-day (or configurable) Due Reminders to Location Heads
   * 2. Overdue Reminders to Location Heads
   * 3. 'Sent for Calibration' items are suppressed automatically
   */
  @Cron('0 9 * * *')
  async runDailyStatusNotifications() {
    this.logger.log('🕒 Running daily status-driven calibration notifications...');
    try {
      await this.processDueSoonReminders();
      await this.processOverdueReminders();
    } catch (err) {
      this.logger.error(`Error running status notifications: ${err.message}`, err.stack);
    }
  }

  /**
   * 1. 15 Days for Due (or company-configured threshold): Daily reminder to Location Head
   */
  async processDueSoonReminders() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Fetch all unique companies from LocationEmail or Setting
    const settings = await this.settingRepository.find();
    const companySettingsMap = new Map<string, Setting>();
    settings.forEach((s) => {
      if (s.companyId) companySettingsMap.set(s.companyId, s);
    });

    const locationMappings = await this.locationEmailRepository.find();
    if (locationMappings.length === 0) {
      this.logger.debug('No location mappings configured. Skipping location-based due reminders.');
      return;
    }

    for (const locMap of locationMappings) {
      if (!locMap.headEmail || !locMap.location) continue;

      const setting = companySettingsMap.get(locMap.companyId);
      const thresholdDays = setting?.dueReminderThresholdDays || 15;

      const targetEnd = new Date(today);
      targetEnd.setDate(today.getDate() + thresholdDays);
      targetEnd.setHours(23, 59, 59, 999);

      // Find instruments at this location due between today and targetEnd (case-insensitive trimmed location)
      const dueInstruments = await this.instrumentRepository
        .createQueryBuilder('i')
        .where('i.companyId = :companyId', { companyId: locMap.companyId })
        .andWhere('LOWER(TRIM(i.location)) = LOWER(TRIM(:location))', { location: locMap.location })
        .andWhere('i.due_date BETWEEN :today AND :targetEnd', { today, targetEnd })
        .getMany();

      // Filter out instruments currently 'Sent for Calibration', 'Under Calibration' or non-calibratable ('Scrapped', 'Lost', 'Inactive', 'Under Repair', 'Rejected')
      const filtered = dueInstruments.filter((inst) => {
        const s = (inst.status || '').toLowerCase().trim();
        const itemS = (inst.item_status || '').toLowerCase().trim();
        const nonCalibratable = ['scrapped', 'lost', 'inactive', 'under repair', 'rejected'];
        const isUnderCalOrSent = s === 'sent for calibration' || s.includes('under calibration') || s === 'under_calibration';
        return !isUnderCalOrSent && !nonCalibratable.includes(itemS);
      });

      if (filtered.length === 0) continue;

      // Build HTML email
      const tableRows = filtered
        .map(
          (inst, i) => `
          <tr style="background:${i % 2 === 0 ? '#f9f9f9' : '#ffffff'};">
            <td style="padding:8px;border:1px solid #ddd;text-align:center;">${i + 1}</td>
            <td style="padding:8px;border:1px solid #ddd;font-weight:bold;">${escapeHtml(inst.id_code || '-')}</td>
            <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(inst.name)}</td>
            <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(inst.serial_no || '-')}</td>
            <td style="padding:8px;border:1px solid #ddd;color:#d97706;font-weight:bold;">${inst.due_date ? new Date(inst.due_date).toLocaleDateString() : '-'}</td>
            <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(inst.agency || '-')}</td>
          </tr>`,
        )
        .join('');

      const html = `
        <div style="font-family:Arial, sans-serif; color:#333; max-width:700px; margin:0 auto;">
          <h2 style="color:#2563eb; border-bottom:2px solid #2563eb; padding-bottom:8px;">
            Calibration Reminder: Instruments Due Soon
          </h2>
          <p>Dear <strong>${escapeHtml(locMap.headName || 'Location Head')}</strong>,</p>
          <p>The following <strong>${filtered.length}</strong> instrument(s) at <strong>${escapeHtml(locMap.location)}</strong> are due for calibration within <strong>${thresholdDays} days</strong>. Please submit them to the calibration lab.</p>
          
          <table style="width:100%; border-collapse:collapse; margin-top:16px; font-size:13px;">
            <thead>
              <tr style="background:#2563eb; color:#fff;">
                <th style="padding:8px;border:1px solid #ddd;">#</th>
                <th style="padding:8px;border:1px solid #ddd;">ID Code</th>
                <th style="padding:8px;border:1px solid #ddd;">Instrument Name</th>
                <th style="padding:8px;border:1px solid #ddd;">Serial No</th>
                <th style="padding:8px;border:1px solid #ddd;">Due Date</th>
                <th style="padding:8px;border:1px solid #ddd;">Agency</th>
              </tr>
            </thead>
            <tbody>${tableRows}</tbody>
          </table>

          <p style="margin-top:20px; font-size:12px; color:#666;">
            Once an instrument is sent to the lab, update its status to <em>"Sent for Calibration"</em> in GaugeMaster to pause automated reminders.
          </p>
        </div>
      `;

      const subject = `[Calibration Due Soon] ${filtered.length} instrument(s) due at ${locMap.location}`;

      try {
        await this.mailerService.sendMail({
          to: [locMap.headEmail],
          subject,
          html,
          companyId: locMap.companyId,
        });

        await this.notificationsService.createNotification({
          companyId: locMap.companyId,
          type: 'gauge_due',
          title: `Due Reminder: ${locMap.location}`,
          message: `${filtered.length} instrument(s) at ${locMap.location} are due for calibration within ${thresholdDays} days.`,
        });

        this.logger.log(`📧 Due soon reminder sent to ${locMap.headEmail} for ${filtered.length} instruments at ${locMap.location}`);
      } catch (e) {
        this.logger.error(`Failed to send due soon reminder to ${locMap.headEmail}: ${e.message}`);
      }
    }
  }

  /**
   * 2. Overdue: Daily reminder to Location Head until status changes
   */
  async processOverdueReminders() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const locationMappings = await this.locationEmailRepository.find();
    if (locationMappings.length === 0) return;

    for (const locMap of locationMappings) {
      if (!locMap.headEmail || !locMap.location) continue;

      const overdueInstruments = await this.instrumentRepository
        .createQueryBuilder('i')
        .where('i.companyId = :companyId', { companyId: locMap.companyId })
        .andWhere('LOWER(TRIM(i.location)) = LOWER(TRIM(:location))', { location: locMap.location })
        .andWhere('i.due_date < :today', { today })
        .getMany();

      // Filter out instruments currently 'Sent for Calibration', 'Under Calibration' or non-calibratable
      const filtered = overdueInstruments.filter((inst) => {
        const s = (inst.status || '').toLowerCase().trim();
        const itemS = (inst.item_status || '').toLowerCase().trim();
        const nonCalibratable = ['scrapped', 'lost', 'inactive', 'under repair', 'rejected'];
        const isUnderCalOrSent = s === 'sent for calibration' || s.includes('under calibration') || s === 'under_calibration';
        return !isUnderCalOrSent && !nonCalibratable.includes(itemS);
      });

      if (filtered.length === 0) continue;

      const tableRows = filtered
        .map(
          (inst, i) => `
          <tr style="background:${i % 2 === 0 ? '#fff1f2' : '#ffffff'};">
            <td style="padding:8px;border:1px solid #ddd;text-align:center;">${i + 1}</td>
            <td style="padding:8px;border:1px solid #ddd;font-weight:bold;color:#b91c1c;">${escapeHtml(inst.id_code || '-')}</td>
            <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(inst.name)}</td>
            <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(inst.serial_no || '-')}</td>
            <td style="padding:8px;border:1px solid #ddd;color:#b91c1c;font-weight:bold;">${inst.due_date ? new Date(inst.due_date).toLocaleDateString() : '-'}</td>
            <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(inst.agency || '-')}</td>
          </tr>`,
        )
        .join('');

      const html = `
        <div style="font-family:Arial, sans-serif; color:#333; max-width:700px; margin:0 auto;">
          <h2 style="color:#b91c1c; border-bottom:2px solid #b91c1c; padding-bottom:8px;">
            ⚠️ OVERDUE CALIBRATION ALERT
          </h2>
          <p>Dear <strong>${escapeHtml(locMap.headName || 'Location Head')}</strong>,</p>
          <p>The following <strong>${filtered.length}</strong> instrument(s) at <strong>${escapeHtml(locMap.location)}</strong> have <span style="color:#b91c1c;font-weight:bold;">passed their calibration due date</span>. Please submit them to the lab immediately.</p>
          
          <table style="width:100%; border-collapse:collapse; margin-top:16px; font-size:13px;">
            <thead>
              <tr style="background:#b91c1c; color:#fff;">
                <th style="padding:8px;border:1px solid #ddd;">#</th>
                <th style="padding:8px;border:1px solid #ddd;">ID Code</th>
                <th style="padding:8px;border:1px solid #ddd;">Instrument Name</th>
                <th style="padding:8px;border:1px solid #ddd;">Serial No</th>
                <th style="padding:8px;border:1px solid #ddd;">Due Date</th>
                <th style="padding:8px;border:1px solid #ddd;">Agency</th>
              </tr>
            </thead>
            <tbody>${tableRows}</tbody>
          </table>

          <p style="margin-top:20px; font-size:12px; color:#666;">
            Daily reminders will continue until the instrument status is updated or sent for calibration.
          </p>
        </div>
      `;

      const subject = `[OVERDUE ACTION REQUIRED] ${filtered.length} Overdue instrument(s) at ${locMap.location}`;

      try {
        await this.mailerService.sendMail({
          to: [locMap.headEmail],
          subject,
          html,
          companyId: locMap.companyId,
        });

        await this.notificationsService.createNotification({
          companyId: locMap.companyId,
          type: 'gauge_due',
          title: `Overdue Alert: ${locMap.location}`,
          message: `${filtered.length} instrument(s) at ${locMap.location} are overdue for calibration.`,
        });

        this.logger.log(`📧 Overdue alert sent to ${locMap.headEmail} for ${filtered.length} instruments at ${locMap.location}`);
      } catch (e) {
        this.logger.error(`Failed to send overdue alert to ${locMap.headEmail}: ${e.message}`);
      }
    }
  }

  /**
   * 4. Calibrated: Final notification to the Location Head to collect the instrument from the lab.
   * Triggered when calibration is completed (internally generated or external certificate/date update).
   */
  async notifyCalibrated(instrument: Partial<Instrument>) {
    if (!instrument || !instrument.companyId || !instrument.location) {
      this.logger.debug('Skipping calibrated collection notification: missing companyId or location.');
      return;
    }

    const locMap = await this.locationEmailRepository
      .createQueryBuilder('l')
      .where('l.companyId = :companyId', { companyId: instrument.companyId })
      .andWhere('LOWER(TRIM(l.location)) = LOWER(TRIM(:location))', { location: instrument.location })
      .getOne();

    if (!locMap || !locMap.headEmail) {
      this.logger.debug(`No Location Head mapped for company ${instrument.companyId} location "${instrument.location}".`);
      return;
    }

    const lastCalStr = instrument.last_calibration_date ? new Date(instrument.last_calibration_date).toLocaleDateString() : '-';
    const dueStr = instrument.due_date ? new Date(instrument.due_date).toLocaleDateString() : '-';

    const html = `
      <div style="font-family:Arial, sans-serif; color:#333; max-width:600px; margin:0 auto; padding:20px; border:1px solid #e2e8f0; border-radius:8px;">
        <h2 style="color:#16a34a; border-bottom:2px solid #16a34a; padding-bottom:8px; margin-top:0;">
          ✅ Calibration Complete — Ready for Collection
        </h2>
        <p>Dear <strong>${escapeHtml(locMap.headName || 'Location Head')}</strong>,</p>
        <p>The calibration process has been completed for the following instrument at <strong>${escapeHtml(instrument.location)}</strong>. You may now collect the instrument from the lab.</p>
        
        <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:6px; padding:16px; margin:16px 0;">
          <table style="width:100%; font-size:14px; line-height:1.6;">
            <tr>
              <td style="width:40%; font-weight:bold; color:#15803d;">Instrument Name:</td>
              <td>${escapeHtml(instrument.name || '-')}</td>
            </tr>
            <tr>
              <td style="font-weight:bold; color:#15803d;">ID Code / IMTE:</td>
              <td>${escapeHtml(instrument.id_code || '-')}</td>
            </tr>
            <tr>
              <td style="font-weight:bold; color:#15803d;">Serial No:</td>
              <td>${escapeHtml(instrument.serial_no || '-')}</td>
            </tr>
            <tr>
              <td style="font-weight:bold; color:#15803d;">Calibration Date:</td>
              <td>${escapeHtml(lastCalStr)}</td>
            </tr>
            <tr>
              <td style="font-weight:bold; color:#15803d;">Next Due Date:</td>
              <td style="font-weight:bold; color:#16a34a;">${escapeHtml(dueStr)}</td>
            </tr>
            <tr>
              <td style="font-weight:bold; color:#15803d;">Status:</td>
              <td><span style="background:#22c55e; color:#fff; padding:2px 8px; border-radius:4px; font-size:12px; font-weight:bold;">CALIBRATED / OK</span></td>
            </tr>
          </table>
        </div>

        <p style="font-size:13px; color:#555;">
          Please verify the instrument and update physical records upon collection.
        </p>
      </div>
    `;

    const subject = `[Calibration Complete] Ready for Collection: ${escapeHtml(instrument.name)} (${escapeHtml(instrument.id_code)})`;

    try {
      await this.mailerService.sendMail({
        to: [locMap.headEmail],
        subject,
        html,
        companyId: instrument.companyId,
      });

      await this.notificationsService.createNotification({
        companyId: instrument.companyId,
        type: 'gauge_calibrated',
        title: `Instrument Calibrated: ${instrument.name}`,
        message: `Instrument "${instrument.name}" (${instrument.id_code}) at ${instrument.location} is calibrated and ready for collection.`,
      });

      this.logger.log(`📧 Collection notification sent to ${locMap.headEmail} for instrument ${instrument.id_code}`);
    } catch (e) {
      this.logger.error(`Failed to send collection notification to ${locMap.headEmail}: ${e.message}`);
    }
  }
}
