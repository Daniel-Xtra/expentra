import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
} from 'typeorm';
import { ApprovalDecision } from './expense.enums';
import { Expense } from './expense.entity';
import { User } from './user.entity';
import { ApprovalLevel } from './approval-level.entity';
import { EntityReferencePrefix } from '../constants/entity-reference-prefix';
import { assignEntityReference } from '../helpers/entity-reference.util';

@Entity('expense_approvals')
export class ExpenseApproval {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'reference', type: 'varchar', length: 36, unique: true })
  reference: string;

  @BeforeInsert()
  protected assignReference(): void {
    assignEntityReference(this, EntityReferencePrefix.EXPENSE_APPROVAL);
  }

  @Column({ type: 'integer', name: 'expense_id' })
  expenseId: number;

  @Column({ type: 'integer', name: 'approval_level_id' })
  approvalLevelId: number;

  @ManyToOne(() => ApprovalLevel, (approvalLevel) => approvalLevel.approvals, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'approval_level_id' })
  approvalLevel: ApprovalLevel;

  @ManyToOne(() => Expense, (expense) => expense.approvals, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'expense_id' })
  expense: Expense;

  @Column({ type: 'integer', name: 'approver_id' })
  approverId: number;

  @ManyToOne(() => User, (user) => user.expenseApprovals, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'approver_id' })
  approver: User;

  @Column({
    type: 'enum',
    enum: ApprovalDecision,
    enumName: 'approval_decision_enum',
  })
  decision: ApprovalDecision;

  @Column({ type: 'text', nullable: true })
  comment?: string;

  @Column({ type: 'timestamptz', name: 'decided_at' })
  decidedAt: Date;

  @Column({ type: 'jsonb', name: 'metadata', nullable: true })
  metadata?: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
