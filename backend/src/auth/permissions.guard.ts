import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { PERMISSION_KEY, PermissionMetadata } from './require-permission.decorator';

/**
 * Guard that enforces module-level RBAC permissions.
 *
 * - If no @RequirePermission decorator is present, the route is allowed (read-only).
 * - Super Admins (`isSuperAdmin: true`) bypass all permission checks.
 * - Otherwise, the user's role permissions matrix is checked.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Read the @RequirePermission metadata from the handler
    const required = this.reflector.getAllAndOverride<PermissionMetadata | undefined>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No permission decorator → allow (e.g. GET endpoints without explicit protection)
    if (!required) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const jwtUser = request.user;

    if (!jwtUser || !jwtUser.userId) {
      throw new ForbiddenException('Authentication required');
    }

    // Super Admin bypasses all permission checks
    if (jwtUser.isSuperAdmin) {
      return true;
    }

    // Fetch user with eager-loaded role from database to get latest permissions
    const user = await this.userRepository.findOne({
      where: { id: jwtUser.userId },
      relations: ['role'],
    });

    if (!user) {
      throw new ForbiddenException('User not found');
    }

    const role = user.role;
    if (!role || !role.permissions) {
      throw new ForbiddenException(
        `You do not have permission to ${required.action} ${required.module}`,
      );
    }

    const modulePermissions = role.permissions[required.module];
    if (!modulePermissions || !modulePermissions[required.action]) {
      throw new ForbiddenException(
        `You do not have permission to ${required.action} ${required.module}`,
      );
    }

    return true;
  }
}
