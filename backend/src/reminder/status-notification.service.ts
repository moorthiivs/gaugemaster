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
   * Minute Cron to check and dispatch company-configured Location Head notifications:
   * 1. Due Reminders to Location Heads based on configured reminder window
   * 2. Overdue Reminders to Location Heads
   * Runs at each company's configured `reminderDispatchTime` (default 09:00 AM IST)
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleScheduledStatusNotifications() {
    try {
      const now = new Date();
      // Format current hour and minute in Asia/Kolkata (IST)
      const timeFormatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      const currentTimeStr = timeFormatter.format(now); // e.g. "09:00"

      const dateFormatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      const todayDateStr = dateFormatter.format(now); // e.g. "2026-11-14"

      const settings = await this.settingRepository.find();
      for (const setting of settings) {
        if (!setting.companyId) continue;
        const targetTime = (setting.reminderDispatchTime || '09:00').trim();

        if (targetTime === currentTimeStr && setting.lastReminderSentDate !== todayDateStr) {
          this.logger.log(`🕒 Triggering daily location reminders for company ${setting.companyId} at scheduled time ${targetTime} (Date: ${todayDateStr})...`);
          await this.processDueSoonReminders(setting.companyId);
          await this.processOverdueReminders(setting.companyId);

          setting.lastReminderSentDate = todayDateStr;
          await this.settingRepository.update(setting.id, { lastReminderSentDate: todayDateStr });
        }
      }

      // Also ensure unconfigured companies with location mappings get default 09:00 dispatch
      if (currentTimeStr === '09:00') {
        const configuredCompanyIds = new Set(settings.map((s) => s.companyId).filter(Boolean));
        const allLocationMappings = await this.locationEmailRepository.find();
        const unconfiguredCompanies = new Set(
          allLocationMappings
            .map((l) => l.companyId)
            .filter((c) => c && !configuredCompanyIds.has(c)),
        );
        for (const unconfiguredCompId of unconfiguredCompanies) {
          await this.processDueSoonReminders(unconfiguredCompId);
          await this.processOverdueReminders(unconfiguredCompId);
        }
      }
    } catch (err) {
      this.logger.error(`Error in handleScheduledStatusNotifications: ${err.message}`, err.stack);
    }
  }

  /**
   * Manually trigger location reminders on-demand (used for testing or immediate trigger)
   */
  async triggerManualReminders(companyId: string): Promise<{ dueSent: number; overdueSent: number; message: string }> {
    const dueSent = await this.processDueSoonReminders(companyId);
    const overdueSent = await this.processOverdueReminders(companyId);
    return {
      dueSent,
      overdueSent,
      message: `Location reminders processed: ${dueSent} due soon email(s) and ${overdueSent} overdue email(s) dispatched.`,
    };
  }

  /**
   * 1. 15 Days for Due (or company-configured threshold): Daily reminder to Location Head
   */
  async processDueSoonReminders(companyId?: string): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Fetch all unique companies from LocationEmail or Setting
    const settings = await this.settingRepository.find();
    const companySettingsMap = new Map<string, Setting>();
    settings.forEach((s) => {
      if (s.companyId) companySettingsMap.set(s.companyId, s);
    });

    let locationMappings = await this.locationEmailRepository.find();
    if (companyId) {
      locationMappings = locationMappings.filter((l) => l.companyId === companyId);
    }
    if (locationMappings.length === 0) {
      this.logger.debug(`No location mappings found for due reminders${companyId ? ` (company: ${companyId})` : ''}.`);
      return 0;
    }

    let sentCount = 0;
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

        sentCount++;
        this.logger.log(`📧 Due soon reminder sent to ${locMap.headEmail} for ${filtered.length} instruments at ${locMap.location}`);
      } catch (e) {
        this.logger.error(`Failed to send due soon reminder to ${locMap.headEmail}: ${e.message}`);
      }
    }
    return sentCount;
  }

  /**
   * 2. Overdue: Daily reminder to Location Head until status changes
   */
  async processOverdueReminders(companyId?: string): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let locationMappings = await this.locationEmailRepository.find();
    if (companyId) {
      locationMappings = locationMappings.filter((l) => l.companyId === companyId);
    }
    if (locationMappings.length === 0) return 0;

    let sentCount = 0;
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

        sentCount++;
        this.logger.log(`📧 Overdue alert sent to ${locMap.headEmail} for ${filtered.length} instruments at ${locMap.location}`);
      } catch (e) {
        this.logger.error(`Failed to send overdue alert to ${locMap.headEmail}: ${e.message}`);
      }
    }
    return sentCount;
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
