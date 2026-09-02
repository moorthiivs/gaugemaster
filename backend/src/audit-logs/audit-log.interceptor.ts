import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditLogsService } from './audit-logs.service';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest();
    const { method, url } = request;

    // Determine if this request should be audited
    const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
    const isAuthLogin = url.includes('/api/auth/login') || url.includes('/api/auth/google/token');
    const isAuthLogout = url.includes('/api/auth/logout');
    const isSpecialDownload = 
      url.includes('/certificate/download') || 
      url.includes('/backup/download') ||
      url.includes('/reports/export');

    // Skip normal GET read requests, polling, metrics, and health checks
    if (!isMutation && !isAuthLogin && !isAuthLogout && !isSpecialDownload) {
      return next.handle();
    }

    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: (response) => {
          this.recordAudit(context, response, null, startTime);
        },
        error: (error) => {
          this.recordAudit(context, null, error, startTime);
        },
      }),
    );
  }

  private async recordAudit(
    context: ExecutionContext,
    response: any,
    error: any,
    startTime: number,
  ) {
    try {
      const ctx = context.switchToHttp();
      const request = ctx.getRequest();
      const res = ctx.getResponse();
      const { method, url, user, body, params, query, headers, ip } = request;

      // Extract client user context (support login response or jwt user)
      let currentUser = user;
      const isAuthLogin = url.includes('/api/auth/login') || url.includes('/api/auth/google/token');
      if (isAuthLogin && response && response.user) {
        currentUser = response.user;
      }

      // Extract resolved user ID and company ID
      const finalUserId = currentUser?.id || currentUser?.userId || currentUser?.sub || null;
      const companyId = 
        currentUser?.companyId || 
        body?.companyId || 
        query?.companyId || 
        params?.companyId || 
        headers?.['x-company-id'] || 
        null;

      // Determine execution status and HTTP response code
      const isSuccess = !error;
      const statusCode = error ? (error.status || error.statusCode || 500) : (res.statusCode || 200);
      const durationMs = Date.now() - startTime;

      // Extract client IP address
      const clientIp = 
        headers['x-forwarded-for']?.toString().split(',')[0].trim() || 
        ip || 
        request.socket?.remoteAddress || 
        '127.0.0.1';

      // Parse Action, ResourceType, and Human Description
      const { action, resourceType, description } = this.parseActionDetails(
        method,
        url,
        body,
        params,
        query,
        isSuccess,
        error,
      );

      // Sanitize request body for privacy / security
      const safeBody = body ? { ...body } : {};
      if (safeBody.password) delete safeBody.password;
      if (safeBody.currentPassword) delete safeBody.currentPassword;
      if (safeBody.newPassword) delete safeBody.newPassword;
      if (safeBody.token) delete safeBody.token;
      if (safeBody.signature && safeBody.signature.length > 200) {
        safeBody.signature = '[Base64 Signature Data]';
      }
      if (safeBody.fileBase64) {
        safeBody.fileBase64 = '[Base64 File Data]';
      }

      await this.auditLogsService.createLog({
        userId: finalUserId,
        companyId,
        action,
        status: isSuccess ? 'SUCCESS' : 'FAILED',
        statusCode,
        description,
        resourceType,
        resource: url.split('?')[0],
        method,
        ipAddress: clientIp,
        durationMs,
        details: {
          method,
          url,
          params,
          query,
          body: safeBody,
          userAgent: headers['user-agent'] || 'Unknown Agent',
          error: error ? (error.message || 'Operation failed') : undefined,
        },
      });
    } catch (err) {
      console.error('AuditLogInterceptor failed to record log entry:', err);
    }
  }

  private parseActionDetails(
    method: string,
    rawUrl: string,
    body: any,
    params: any,
    query: any,
    isSuccess: boolean,
    error: any,
  ): { action: string; resourceType: string; description: string } {
    const url = rawUrl.toLowerCase();

    // ── Authentication & Access ──────────────────────────────────────────────
    if (url.includes('/api/auth/login')) {
      return {
        action: 'LOGIN',
        resourceType: 'Authentication',
        description: isSuccess
          ? `User logged in successfully (${body?.email || 'credentials'})`
          : `Failed login attempt for email: ${body?.email || 'unknown'}`,
      };
    }
    if (url.includes('/api/auth/google/token')) {
      return {
        action: 'LOGIN',
        resourceType: 'Authentication',
        description: isSuccess ? 'User authenticated via Google SSO' : 'Failed Google SSO login attempt',
      };
    }
    if (url.includes('/api/auth/logout')) {
      return {
        action: 'LOGOUT',
        resourceType: 'Authentication',
        description: 'User logged out and terminated active session',
      };
    }
    if (url.includes('/api/auth/register')) {
      return {
        action: 'REGISTER',
        resourceType: 'Authentication',
        description: `Registered new user account: ${body?.email || body?.name || 'User'}`,
      };
    }

    // ── Calibrations & Approvals ─────────────────────────────────────────────
    if (url.includes('/api/calibrations') && url.includes('/approve')) {
      return {
        action: 'CALIBRATION_APPROVE',
        resourceType: 'Calibration',
        description: `Approved calibration record${body?.reviewerName ? ` (Reviewer: ${body.reviewerName})` : ''}`,
      };
    }
    if (url.includes('/api/calibrations') && url.includes('/reject')) {
      return {
        action: 'CALIBRATION_REJECT',
        resourceType: 'Calibration',
        description: `Rejected calibration record${body?.rejectionReason ? ` - Reason: "${body.rejectionReason}"` : ''}`,
      };
    }
    if (url.includes('/api/calibrations') && url.includes('/certificate/download')) {
      return {
        action: 'CERTIFICATE_DOWNLOAD',
        resourceType: 'Certificate',
        description: 'Downloaded calibration certificate document',
      };
    }
    if (url.includes('/api/calibrations') && url.includes('/certificate')) {
      return {
        action: 'CERTIFICATE_GENERATE',
        resourceType: 'Certificate',
        description: 'Generated calibration certificate PDF',
      };
    }
    if (url.includes('/api/calibrations') && url.includes('/draft') && method === 'DELETE') {
      return {
        action: 'DRAFT_DELETE',
        resourceType: 'Calibration',
        description: 'Discarded calibration draft worksheet',
      };
    }
    if (url.includes('/api/calibrations') && url.includes('/draft')) {
      return {
        action: 'DRAFT_SAVE',
        resourceType: 'Calibration',
        description: 'Saved calibration draft worksheet data',
      };
    }
    if (url.startsWith('/api/calibrations') && method === 'POST') {
      return {
        action: 'CALIBRATION_CREATE',
        resourceType: 'Calibration',
        description: `Created calibration execution record (Cert #${body?.certificate_number || body?.certificateNumber || 'Draft'})`,
      };
    }
    if (url.startsWith('/api/calibrations') && (method === 'PUT' || method === 'PATCH')) {
      return {
        action: 'CALIBRATION_UPDATE',
        resourceType: 'Calibration',
        description: 'Updated calibration execution details / observations',
      };
    }
    if (url.startsWith('/api/calibrations') && method === 'DELETE') {
      return {
        action: 'CALIBRATION_DELETE',
        resourceType: 'Calibration',
        description: `Deleted calibration execution record (ID: ${params?.id || 'Record'})`,
      };
    }

    // ── Calibration Templates ────────────────────────────────────────────────
    if (url.includes('/api/calibration-templates') && url.includes('/export')) {
      return {
        action: 'TEMPLATE_EXPORT',
        resourceType: 'Template',
        description: 'Exported calibration templates package (.zip)',
      };
    }
    if (url.includes('/api/calibration-templates') && url.includes('/import/validate')) {
      return {
        action: 'TEMPLATE_VALIDATE',
        resourceType: 'Template',
        description: 'Validated template package upload structure',
      };
    }
    if (url.includes('/api/calibration-templates') && url.includes('/import')) {
      return {
        action: 'TEMPLATE_IMPORT',
        resourceType: 'Template',
        description: 'Imported calibration templates package',
      };
    }
    if (url.startsWith('/api/calibration-templates') && method === 'POST') {
      return {
        action: 'TEMPLATE_CREATE',
        resourceType: 'Template',
        description: `Created calibration template: "${body?.name || body?.title || 'New Template'}"`,
      };
    }
    if (url.startsWith('/api/calibration-templates') && (method === 'PUT' || method === 'PATCH')) {
      return {
        action: 'TEMPLATE_UPDATE',
        resourceType: 'Template',
        description: `Updated calibration template: "${body?.name || body?.title || params?.id || 'Template'}"`,
      };
    }
    if (url.startsWith('/api/calibration-templates') && method === 'DELETE') {
      return {
        action: 'TEMPLATE_DELETE',
        resourceType: 'Template',
        description: `Deleted calibration template (ID: ${params?.id || 'Template'})`,
      };
    }

    // ── Instruments / Gauges ────────────────────────────────────────────────
    if (url.startsWith('/api/instruments') && method === 'POST') {
      return {
        action: 'INSTRUMENT_CREATE',
        resourceType: 'Instrument',
        description: `Created new instrument/gauge: "${body?.name || body?.equipment_name || body?.tag_number || 'New Gauge'}"`,
      };
    }
    if (url.startsWith('/api/instruments') && (method === 'PUT' || method === 'PATCH')) {
      return {
        action: 'INSTRUMENT_UPDATE',
        resourceType: 'Instrument',
        description: `Updated instrument/gauge: "${body?.name || body?.equipment_name || body?.tag_number || params?.id || 'Gauge'}"`,
      };
    }
    if (url.startsWith('/api/instruments') && method === 'DELETE') {
      return {
        action: 'INSTRUMENT_DELETE',
        resourceType: 'Instrument',
        description: `Deleted instrument gauge record (ID: ${params?.id || 'Item'})`,
      };
    }

    // ── User Management ─────────────────────────────────────────────────────
    if ((url.includes('/api/users') || url.includes('/users')) && url.includes('/invite')) {
      return {
        action: 'USER_INVITE',
        resourceType: 'User',
        description: `Sent system invitation to: ${body?.email || 'User'}`,
      };
    }
    if ((url.includes('/api/users') || url.includes('/users')) && method === 'POST') {
      return {
        action: 'USER_CREATE',
        resourceType: 'User',
        description: `Created user account: "${body?.email || body?.name || 'New User'}"`,
      };
    }
    if ((url.includes('/api/users') || url.includes('/users')) && (method === 'PUT' || method === 'PATCH')) {
      return {
        action: 'USER_UPDATE',
        resourceType: 'User',
        description: `Updated user profile/roles: "${body?.email || body?.name || params?.id || 'User'}"`,
      };
    }
    if ((url.includes('/api/users') || url.includes('/users')) && method === 'DELETE') {
      return {
        action: 'USER_DELETE',
        resourceType: 'User',
        description: `Deleted user account (ID: ${params?.id || 'User'})`,
      };
    }

    // ── Roles & Permissions ─────────────────────────────────────────────────
    if ((url.includes('/api/roles') || url.includes('/roles')) && method === 'POST') {
      return {
        action: 'ROLE_CREATE',
        resourceType: 'Role',
        description: `Created role: "${body?.name || 'New Role'}"`,
      };
    }
    if ((url.includes('/api/roles') || url.includes('/roles')) && (method === 'PUT' || method === 'PATCH')) {
      return {
        action: 'ROLE_UPDATE',
        resourceType: 'Role',
        description: `Updated role permissions: "${body?.name || params?.id || 'Role'}"`,
      };
    }
    if ((url.includes('/api/roles') || url.includes('/roles')) && method === 'DELETE') {
      return {
        action: 'ROLE_DELETE',
        resourceType: 'Role',
        description: `Deleted role (ID: ${params?.id || 'Role'})`,
      };
    }

    // ── Super Admin & Companies ─────────────────────────────────────────────
    if (url.includes('/api/super-admin/companies') && url.includes('/access')) {
      return {
        action: 'COMPANY_ACCESS_UPDATE',
        resourceType: 'Company',
        description: `Updated tenant access: ${body?.accessStatus || 'Modified status'}`,
      };
    }
    if (url.includes('/api/super-admin/companies') && method === 'DELETE') {
      return {
        action: 'COMPANY_DELETE',
        resourceType: 'Company',
        description: `Permanently deleted customer company tenant (ID: ${params?.id})`,
      };
    }
    if (url.includes('/api/super-admin/companies') && (method === 'PATCH' || method === 'PUT')) {
      return {
        action: 'COMPANY_UPDATE',
        resourceType: 'Company',
        description: `Updated company details: "${body?.companyName || 'Company'}"`,
      };
    }
    if (url.includes('/api/company') && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      return {
        action: 'COMPANY_UPDATE',
        resourceType: 'Company',
        description: 'Updated company profile, branding, or address',
      };
    }

    // ── System Backups ──────────────────────────────────────────────────────
    if (url.includes('/api/backup/restore')) {
      return {
        action: 'BACKUP_RESTORE',
        resourceType: 'Backup',
        description: `Restored database backup (${body?.filename || 'archive'})`,
      };
    }
    if (url.includes('/api/backup/download')) {
      return {
        action: 'BACKUP_DOWNLOAD',
        resourceType: 'Backup',
        description: 'Downloaded database backup archive',
      };
    }
    if (url.includes('/api/backup') && method === 'POST') {
      return {
        action: 'BACKUP_CREATE',
        resourceType: 'Backup',
        description: 'Initiated manual database backup',
      };
    }

    // ── Settings & Configurations ───────────────────────────────────────────
    if (url.includes('/api/settings')) {
      return {
        action: 'SETTINGS_UPDATE',
        resourceType: 'Settings',
        description: 'Updated system preferences / email / calibration settings',
      };
    }
    if (url.includes('/api/reminder')) {
      return {
        action: 'REMINDER_UPDATE',
        resourceType: 'Settings',
        description: 'Configured automated reminder rules',
      };
    }

    // ── Reports & Analytics ─────────────────────────────────────────────────
    if (url.includes('/api/report-templates') && method === 'POST') {
      return {
        action: 'REPORT_TEMPLATE_CREATE',
        resourceType: 'Report',
        description: `Created report template: "${body?.name || 'Report'}"`,
      };
    }
    if (url.includes('/api/report-templates') && (method === 'PUT' || method === 'PATCH')) {
      return {
        action: 'REPORT_TEMPLATE_UPDATE',
        resourceType: 'Report',
        description: `Updated report template: "${body?.name || params?.id || 'Report'}"`,
      };
    }
    if (url.includes('/api/report-templates') && method === 'DELETE') {
      return {
        action: 'REPORT_TEMPLATE_DELETE',
        resourceType: 'Report',
        description: `Deleted report template (ID: ${params?.id || 'Report'})`,
      };
    }
    if (url.includes('/api/reports')) {
      return {
        action: 'REPORT_GENERATE',
        resourceType: 'Report',
        description: 'Generated calibration / inventory analytics report',
      };
    }

    // ── Bulk Uploads ────────────────────────────────────────────────────────
    if (url.includes('/api/upload-jobs')) {
      return {
        action: 'BULK_UPLOAD',
        resourceType: 'Instrument',
        description: 'Submitted bulk instrument batch upload job',
      };
    }

    // ── Generic Fallback ────────────────────────────────────────────────────
    let defaultAction = 'MUTATION';
    if (method === 'POST') defaultAction = 'CREATE';
    else if (method === 'PUT' || method === 'PATCH') defaultAction = 'UPDATE';
    else if (method === 'DELETE') defaultAction = 'DELETE';
    else if (method === 'GET') defaultAction = 'READ';

    const pathSegments = rawUrl.split('?')[0].split('/').filter(Boolean);
    const primarySegment = pathSegments.find((p) => !p.match(/^[0-9a-fA-F-]+$/) && p !== 'api') || 'resource';
    const cleanResource = primarySegment.charAt(0).toUpperCase() + primarySegment.slice(1);

    return {
      action: defaultAction,
      resourceType: cleanResource,
      description: `${defaultAction} action performed on ${cleanResource}`,
    };
  }
}

