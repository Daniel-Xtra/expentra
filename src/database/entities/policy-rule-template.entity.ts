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

export type PolicyRuleTemplateCondition = {
  field: string;
  operator: string;
  value: unknown;
  params?: Record<string, unknown>;
};

export type PolicyRuleTemplateMatch = 'all' | 'any';

@Entity('policy_rule_templates')
export class PolicyRuleTemplate {
  @Exclude({ toPlainOnly: true })
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'reference', type: 'varchar', length: 36, unique: true })
  reference: string;

  @BeforeInsert()
  protected assignReference(): void {
    assignEntityReference(this, EntityReferencePrefix.POLICY_RULE_TEMPLATE);
  }

  @Column({ type: 'varchar', length: 128 })
  name: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', length: 8 })
  match: PolicyRuleTemplateMatch;

  @Column({ type: 'jsonb' })
  conditions: PolicyRuleTemplateCondition[];

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean;

  @Column({ type: 'integer', name: 'sort_order', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
