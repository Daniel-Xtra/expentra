import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
  BeforeInsert,
} from 'typeorm';
import { ApprovalApproverType } from './approval-approver-type.enum';
import { ExpenseApproval } from './expense-approval.entity';
import { Role } from './role.entity';
import { EntityReferencePrefix } from '../constants/entity-reference-prefix';
import { assignEntityReference } from '../helpers/entity-reference.util';

const amountColumnTransformer = {
  to: (value: number) => value,
  from: (value: string) => parseInt(value, 10),
};

@Entity('approval_levels')
export class ApprovalLevel {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'reference', type: 'varchar', length: 36, unique: true })
  reference: string;

  @BeforeInsert()
  protected assignReference(): void {
    assignEntityReference(this, EntityReferencePrefix.APPROVAL_LEVEL);
  }

  @Column({ type: 'integer', name: 'role_id', nullable: true })
  roleId?: number | null;

  @ManyToOne(() => Role, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'role_id' })
  role?: Role | null;

  @Column({
    type: 'varchar',
    length: 32,
    name: 'approver_type',
    enum: ApprovalApproverType,
  })
  approverType: ApprovalApproverType;

  @Column({ name: 'name', length: 128 })
  name: string;

  /** Order in the approval chain (lower levels are decided first). */
  @Column({ type: 'smallint', name: 'level', unique: true })
  level: number;

  /** Expense amount must be >= this value for the level to apply. */
  @Column({
    type: 'bigint',
    name: 'minimum_amount',
    transformer: amountColumnTransformer,
  })
  minimumAmount: number;

  /**
   * Expense amount must be <= this value for the level to apply.
   * Null means no upper bound.
   */
  @Column({
    type: 'bigint',
    name: 'maximum_amount',
    nullable: true,
    transformer: {
      to: (value: number | null | undefined) => value ?? null,
      from: (value: string | null) =>
        value === null ? null : parseInt(value, 10),
    },
  })
  maximumAmount?: number | null;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean;

  @Column({ type: 'text', name: 'description', nullable: true })
  description?: string | null;

  @Column({ type: 'jsonb', name: 'metadata', nullable: true })
  metadata?: Record<string, unknown> | null;

  @OneToMany(() => ExpenseApproval, (approval) => approval.approvalLevel)
  approvals: ExpenseApproval[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
