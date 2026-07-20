import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  BeforeInsert,
} from 'typeorm';
import { DepartmentBudget } from './department-budget.entity';
import { User } from './user.entity';
import { Exclude } from 'class-transformer';
import { EntityReferencePrefix } from '../constants/entity-reference-prefix';
import { assignEntityReference } from '../helpers/entity-reference.util';

@Entity('departments')
export class Department {
  @Exclude({ toPlainOnly: true })
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'reference', type: 'varchar', length: 36, unique: true })
  reference: string;

  @BeforeInsert()
  protected assignReference(): void {
    assignEntityReference(this, EntityReferencePrefix.DEPARTMENT);
  }

  @Column({ name: 'name' })
  name: string;

  @Column({ length: 32, name: 'code', unique: true })
  code: string;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean;

  @Column({
    type: 'integer',
    name: 'manager_id',
    nullable: true,
  })
  managerId?: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'manager_id' })
  manager?: User;

  @OneToMany(() => User, (user) => user.department)
  users: User[];

  @OneToMany(() => DepartmentBudget, (budget) => budget.department)
  budgets: DepartmentBudget[];

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
