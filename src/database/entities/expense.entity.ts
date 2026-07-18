import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
} from 'typeorm';
import { ExpenseCategory, ExpenseStatus } from './expense.enums';
import { User } from './user.entity';
import { Department } from './department.entity';
import { ExpenseAttachment } from './expense-attachment.entity';
import { ExpenseApproval } from './expense-approval.entity';
import { Exclude } from 'class-transformer';
import { EntityReferencePrefix } from '../constants/entity-reference-prefix';
import { assignEntityReference } from '../helpers/entity-reference.util';

const amountColumnTransformer = {
  to: (value: number) => value,
  from: (value: string) => parseInt(value, 10),
};

@Entity('expenses')
export class Expense {
  @Exclude({ toPlainOnly: true })
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'reference', type: 'varchar', length: 36, unique: true })
  reference: string;

  @BeforeInsert()
  protected assignReference(): void {
    assignEntityReference(this, EntityReferencePrefix.EXPENSE);
  }

  @Column({ type: 'integer', name: 'user_id' })
  userId: number;

  @Column({
    type: 'integer',
    name: 'department_id',
    nullable: true,
  })
  departmentId?: number | null;

  @ManyToOne(() => Department, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'department_id' })
  department?: Department;

  @ManyToOne(() => User, (user) => user.expenses, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  /** Amount in minor currency units (e.g. kobo for NGN). */
  @Column({
    type: 'bigint',
    name: 'amount',
    transformer: amountColumnTransformer,
  })
  amount: number;

  @Column({ type: 'varchar', length: 3, default: 'NGN' })
  currency: string;

  @Column({ type: 'varchar', length: 64 })
  category: ExpenseCategory;

  @Column({ type: 'varchar', default: ExpenseStatus.DRAFT })
  status: ExpenseStatus;

  @Column({ type: 'timestamptz', name: 'submitted_at', nullable: true })
  submittedAt?: Date;

  @Column({ type: 'timestamptz', name: 'approved_at', nullable: true })
  approvedAt?: Date;

  @Column({ type: 'timestamptz', name: 'rejected_at', nullable: true })
  rejectedAt?: Date;

  @Column({ type: 'timestamptz', name: 'reimbursed_at', nullable: true })
  reimbursedAt?: Date;

  @Column({ type: 'timestamptz', name: 'incurred_at', nullable: true })
  incurredAt?: Date;

  @Column({
    type: 'varchar',
    name: 'reimbursement_reference',
    length: 64,
    nullable: true,
  })
  reimbursementReference?: string | null;

  @Column({ type: 'jsonb', name: 'metadata', nullable: true })
  metadata?: Record<string, unknown> | null;

  @OneToMany(() => ExpenseAttachment, (attachment) => attachment.expense)
  attachments: ExpenseAttachment[];

  @OneToMany(() => ExpenseApproval, (approval) => approval.expense)
  approvals: ExpenseApproval[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
