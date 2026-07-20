import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { EntityReferencePrefix } from '../constants/entity-reference-prefix';
import { assignEntityReference } from '../helpers/entity-reference.util';
import {
  ExpensePolicyRuleType,
  ExpensePolicySeverity,
} from './expense-policy.enums';

@Entity('expense_policies')
export class ExpensePolicy {
  @Exclude({ toPlainOnly: true })
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'reference', type: 'varchar', length: 36, unique: true })
  reference: string;

  @BeforeInsert()
  protected assignReference(): void {
    assignEntityReference(this, EntityReferencePrefix.EXPENSE_POLICY);
  }

  @Column({ type: 'varchar', length: 128 })
  name: string;

  @Column({ type: 'varchar', length: 64, name: 'rule_type' })
  ruleType: ExpensePolicyRuleType;

  @Column({ type: 'varchar', length: 16 })
  severity: ExpensePolicySeverity;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean;

  @Column({ type: 'jsonb' })
  config: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
