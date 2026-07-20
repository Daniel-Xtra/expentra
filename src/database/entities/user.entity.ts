import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  DeleteDateColumn,
  UpdateDateColumn,
  JoinColumn,
  BeforeInsert,
} from 'typeorm';
import { Role } from './role.entity';
import { Department } from './department.entity';
import { Expense } from './expense.entity';
import { ExpenseApproval } from './expense-approval.entity';
import { Notification } from './notification.entity';
import { Exclude } from 'class-transformer';
import { EntityReferencePrefix } from '../constants/entity-reference-prefix';
import { assignEntityReference } from '../helpers/entity-reference.util';

@Entity('users')
export class User {
  @Exclude({ toPlainOnly: true })
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'reference', type: 'varchar', length: 36, unique: true })
  reference: string;

  @BeforeInsert()
  protected assignReference(): void {
    assignEntityReference(this, EntityReferencePrefix.USER);
  }

  @Column({ name: 'email', unique: true })
  email: string;

  @Exclude()
  @Column({ type: 'varchar', select: false, name: 'password', nullable: true })
  password?: string | null;

  /** local | oidc — how the account authenticates */
  @Column({
    name: 'auth_provider',
    type: 'varchar',
    length: 32,
    default: 'local',
  })
  authProvider: string;

  /** IdP subject (`sub`) when authProvider is oidc */
  @Column({ name: 'external_id', type: 'varchar', length: 255, nullable: true })
  externalId?: string | null;

  @Column({ nullable: true, name: 'first_name' })
  firstName?: string;

  @Column({ nullable: true, name: 'last_name' })
  lastName?: string;

  /** Profile image URL from SSO (`picture`) or future uploads */
  @Column({ type: 'varchar', length: 2048, name: 'avatar_url', nullable: true })
  avatarUrl?: string | null;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', name: 'is_email_verified', default: false })
  isEmailVerified: boolean;

  @Column({ type: 'timestamptz', name: 'email_verified_at', nullable: true })
  emailVerifiedAt?: Date | null;

  @Column({
    type: 'integer',
    name: 'role_id',
    nullable: true,
  })
  roleId?: number;

  @ManyToOne(() => Role, (role) => role.users, { nullable: true })
  @JoinColumn({ name: 'role_id' })
  role: Role;

  @Column({
    type: 'integer',
    name: 'department_id',
    nullable: true,
  })
  departmentId?: number;

  @ManyToOne(() => Department, (dept) => dept.users, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'department_id' })
  department?: Department;

  @OneToMany(() => Expense, (expense) => expense.user)
  expenses: Expense[];

  @OneToMany(() => ExpenseApproval, (approval) => approval.approver)
  expenseApprovals: ExpenseApproval[];

  @OneToMany(() => Notification, (notification) => notification.user)
  notifications: Notification[];

  @Column({ type: 'jsonb', name: 'metadata', nullable: true })
  metadata?: Record<string, unknown> | null;

  @Exclude({ toPlainOnly: true })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Exclude({ toPlainOnly: true })
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Exclude({ toPlainOnly: true })
  @Column({ name: 'deactivated_at', type: 'timestamptz', nullable: true })
  deactivatedAt?: Date | null;

  @Exclude({ toPlainOnly: true })
  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at', nullable: true })
  deletedAt?: Date | null;
}
