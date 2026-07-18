import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ParentPermission } from '../entities/parent-permission.entity';
import { ParentPermissionResource } from 'src/modules/authorization/constants/permissions';

@Injectable()
export class ParentPermissionSeeder {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async seed(): Promise<void> {
    const parentPermissions = [
      {
        name: ParentPermissionResource.VIEW_DASHBOARD_MANAGEMENT,
        description: 'Parent permission for dashboard management',
        displayName: 'Dashboard Management',
        isActive: true,
        metadata: {},
      },
      {
        name: ParentPermissionResource.VIEW_USER_MANAGEMENT,
        description: 'Parent permission for user management',
        displayName: 'User Management',
        isActive: true,
        metadata: {},
      },
      {
        name: ParentPermissionResource.VIEW_ROLE_MANAGEMENT,
        description: 'Parent permission for role management',
        displayName: 'Role Management',
        isActive: true,
        metadata: {},
      },
      {
        name: ParentPermissionResource.VIEW_PERMISSION_MANAGEMENT,
        description: 'Parent permission for permission management',
        displayName: 'Permission Management',
        isActive: true,
        metadata: {},
      },
      {
        name: ParentPermissionResource.VIEW_ADMIN_MANAGEMENT,
        description: 'Parent permission for admin management',
        displayName: 'Admin Management',
        isActive: true,
        metadata: {},
      },
      {
        name: ParentPermissionResource.VIEW_DEPARTMENT_MANAGEMENT,
        description: 'Parent permission for department management',
        displayName: 'Department Management',
        isActive: true,
        metadata: {},
      },
      {
        name: ParentPermissionResource.VIEW_EXPENSE_MANAGEMENT,
        description: 'Parent permission for expense management',
        displayName: 'Expense Management',
        isActive: true,
        metadata: {},
      },
      {
        name: ParentPermissionResource.VIEW_APPROVAL_MANAGEMENT,
        description: 'Parent permission for approval management',
        displayName: 'Approval Management',
        isActive: true,
        metadata: {},
      },
      {
        name: ParentPermissionResource.VIEW_RECEIPT_MANAGEMENT,
        description: 'Parent permission for receipt management',
        displayName: 'Receipt Management',
        isActive: true,
        metadata: {},
      },
      {
        name: ParentPermissionResource.VIEW_BUDGET_MANAGEMENT,
        description: 'Parent permission for budget management',
        displayName: 'Budget Management',
        isActive: true,
        metadata: {},
      },
      {
        name: ParentPermissionResource.VIEW_REPORT_MANAGEMENT,
        description: 'Parent permission for report management',
        displayName: 'Report Management',
        isActive: true,
        metadata: {},
      },
      {
        name: ParentPermissionResource.VIEW_NOTIFICATION_MANAGEMENT,
        description: 'Parent permission for notification management',
        displayName: 'Notification Management',
        isActive: true,
        metadata: {},
      },
    ];

    const parentPermissionRepo =
      this.dataSource.getRepository(ParentPermission);

    for (const p of parentPermissions) {
      let parentPermission = await parentPermissionRepo.findOne({
        where: { name: p.name },
      });

      if (parentPermission) {
        parentPermission.description = p.description;
        parentPermission.displayName = p.displayName;
        parentPermission.isActive = p.isActive;
        parentPermission.metadata = p.metadata as Record<string, any>;
      } else {
        parentPermission = parentPermissionRepo.create({
          name: p.name,
          description: p.description,
          displayName: p.displayName,
          isActive: p.isActive,
          metadata: p.metadata as Record<string, any>,
        });
      }

      await parentPermissionRepo.save(parentPermission);
    }

    const retiredParentNames = new Set(['view_audit_log_management']);
    const existingParents = await parentPermissionRepo.find({
      where: { isActive: true },
    });
    for (const parent of existingParents) {
      if (retiredParentNames.has(parent.name)) {
        parent.isActive = false;
        await parentPermissionRepo.save(parent);
      }
    }
  }

  async drop(): Promise<void> {
    const parentPermissionRepo =
      this.dataSource.getRepository(ParentPermission);
    await parentPermissionRepo.delete({});
  }
}

export async function seedParentPermissions(
  dataSource: DataSource,
): Promise<void> {
  await new ParentPermissionSeeder(dataSource).seed();
}
