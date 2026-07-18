import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { SYSTEM_ROLES } from 'src/database/constants/system-roles';
import { ApprovalLevel } from 'src/database/entities/approval-level.entity';
import { User } from 'src/database/entities/user.entity';

@Injectable()
export class BudgetAlertRecipientQueryService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(ApprovalLevel)
    private readonly approvalLevelRepository: Repository<ApprovalLevel>,
  ) {}

  async findSuperAdminRecipients(): Promise<User[]> {
    return this.userRepository.find({
      where: {
        isActive: true,
        role: { name: SYSTEM_ROLES.SUPER_ADMIN },
      },
      relations: { role: true },
    });
  }

  async findApprovalLevelRoleRecipients(): Promise<User[]> {
    const roleRows = await this.approvalLevelRepository
      .createQueryBuilder('approvalLevel')
      .select('approvalLevel.roleId', 'roleId')
      .where('approvalLevel.isActive = :active', { active: true })
      .andWhere('approvalLevel.roleId IS NOT NULL')
      .getRawMany<{ roleId: number }>();

    const roleIds = [
      ...new Set(
        roleRows
          .map((row) => row.roleId)
          .filter((roleId): roleId is number => Number.isInteger(roleId)),
      ),
    ];
    if (roleIds.length === 0) {
      return [];
    }

    return this.userRepository.find({
      where: {
        isActive: true,
        roleId: In(roleIds),
      },
      relations: { role: true },
    });
  }
}
