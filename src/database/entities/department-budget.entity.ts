import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  BeforeInsert,
  Unique,
} from 'typeorm';
import { Department } from './department.entity';
import { Exclude } from 'class-transformer';
import { EntityReferencePrefix } from '../constants/entity-reference-prefix';
import { assignEntityReference } from '../helpers/entity-reference.util';

const amountColumnTransformer = {
  to: (value: number) => value,
  from: (value: string) => parseInt(value, 10),
};

const percentColumnTransformer = {
  to: (value: number) => value,
  from: (value: string) => parseFloat(value),
};

@Entity('department_budgets')
@Unique(['departmentId', 'year'])
export class DepartmentBudget {
  @Exclude({ toPlainOnly: true })
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'reference', type: 'varchar', length: 36, unique: true })
  reference: string;

  @BeforeInsert()
  protected assignReference(): void {
    assignEntityReference(this, EntityReferencePrefix.DEPARTMENT_BUDGET);
  }

  @Column({ type: 'integer', name: 'department_id' })
  departmentId: number;

  @ManyToOne(() => Department, (dept) => dept.budgets, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'department_id' })
  department: Department;

  @Column({ type: 'smallint' })
  year: number;

  @Column({
    type: 'bigint',
    name: 'amount_limit',
    transformer: amountColumnTransformer,
  })
  amountLimit: number;

  @Column({ type: 'varchar', length: 3, default: 'NGN' })
  currency: string;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean;

  @Column({
    type: 'bigint',
    name: 'committed_amount',
    default: 0,
    transformer: amountColumnTransformer,
  })
  committedAmount: number;

  @Column({
    type: 'bigint',
    name: 'reimbursed_amount',
    default: 0,
    transformer: amountColumnTransformer,
  })
  reimbursedAmount: number;

  @Column({
    type: 'bigint',
    name: 'remaining_amount',
    generatedType: 'STORED',
    asExpression: 'GREATEST(0, amount_limit - committed_amount)',
    transformer: amountColumnTransformer,
    insert: false,
    update: false,
  })
  remainingAmount: number;

  @Column({
    type: 'numeric',
    precision: 7,
    scale: 2,
    name: 'utilization_percent',
    generatedType: 'STORED',
    asExpression:
      'CASE WHEN amount_limit > 0 THEN ROUND((committed_amount::numeric / amount_limit) * 10000) / 100 ELSE 0 END',
    transformer: percentColumnTransformer,
    insert: false,
    update: false,
  })
  utilizationPercent: number;

  @Column({
    type: 'boolean',
    name: 'is_over_budget',
    generatedType: 'STORED',
    asExpression: 'committed_amount > amount_limit',
    insert: false,
    update: false,
  })
  isOverBudget: boolean;

  @Column({ type: 'jsonb', name: 'metadata', nullable: true })
  metadata?: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Exclude({ toPlainOnly: true })
  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt?: Date;
}
