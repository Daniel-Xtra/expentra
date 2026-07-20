import type { DataSource } from 'typeorm';
import { APPROVAL_ROLES } from '../constants/approval-roles';
import { EntityReferencePrefix } from '../constants/entity-reference-prefix';
import { ApprovalApproverType } from '../entities/approval-approver-type.enum';
import { ApprovalLevel } from '../entities/approval-level.entity';
import { Role } from '../entities/role.entity';
import { generateEntityReference } from '../helpers/entity-reference.util';

/**
 * Default two-step approval chain used after a fresh migration.
 * Previously seeded by migration AddApprovalApproverTypeAndSeedWorkflow.
 */
export async function seedDefaultApprovalLevels(
  dataSource: DataSource,
): Promise<void> {
  const levelRepo = dataSource.getRepository(ApprovalLevel);
  const existing = await levelRepo.count();
  if (existing > 0) {
    return;
  }

  const financeRole = await dataSource.getRepository(Role).findOne({
    where: { name: APPROVAL_ROLES.FINANCE_MANAGER },
  });

  await levelRepo.save([
    levelRepo.create({
      reference: generateEntityReference(EntityReferencePrefix.APPROVAL_LEVEL),
      name: 'Department Manager',
      level: 1,
      minimumAmount: 0,
      maximumAmount: null,
      approverType: ApprovalApproverType.DEPARTMENT_MANAGER,
      roleId: null,
      isActive: true,
      description: 'First approval by the submitter department manager',
    }),
    levelRepo.create({
      reference: generateEntityReference(EntityReferencePrefix.APPROVAL_LEVEL),
      name: 'Finance Manager',
      level: 2,
      minimumAmount: 0,
      maximumAmount: null,
      approverType: ApprovalApproverType.FINANCE_MANAGER,
      roleId: financeRole?.id ?? null,
      isActive: true,
      description: 'Final finance approval before reimbursement',
    }),
  ]);
}
