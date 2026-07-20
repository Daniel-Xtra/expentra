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

export type PolicyFieldValueType =
  | 'naira'
  | 'number'
  | 'category'
  | 'weekdays'
  | 'boolean';

export type PolicyFieldParamDefinition = {
  key: string;
  label: string;
  type: 'category' | 'number';
  required?: boolean;
};

@Entity('policy_condition_fields')
export class PolicyConditionField {
  @Exclude({ toPlainOnly: true })
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'reference', type: 'varchar', length: 36, unique: true })
  reference: string;

  @BeforeInsert()
  protected assignReference(): void {
    assignEntityReference(this, EntityReferencePrefix.POLICY_CONDITION_FIELD);
  }

  @Column({ type: 'varchar', length: 64, unique: true })
  key: string;

  @Column({ type: 'varchar', length: 128 })
  label: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', length: 32, name: 'value_type' })
  valueType: PolicyFieldValueType;

  @Column({ type: 'jsonb' })
  operators: string[];

  @Column({ type: 'jsonb', name: 'param_definitions', nullable: true })
  paramDefinitions?: PolicyFieldParamDefinition[] | null;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean;

  @Column({ type: 'integer', name: 'sort_order', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
