import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';

const ADMIN_ROLES = new Set([UserRole.ADMIN, UserRole.SUPER_ADMIN]);

@Injectable()
export class AdminRoleGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const user = ctx.switchToHttp().getRequest().user;
    if (!user || !ADMIN_ROLES.has(user.role)) {
      throw new ForbiddenException('Admin access required');
    }
    return true;
  }
}
