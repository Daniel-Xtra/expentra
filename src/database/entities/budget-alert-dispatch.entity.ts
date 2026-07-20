import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { DepartmentBudget } from './department-budget.entity';

@Entity('budget_alert_dispatches')
export class BudgetAlertDispatch {
  @Exclude({ toPlainOnly: true })
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'integer', name: 'department_budget_id' })
  departmentBudgetId: number;

  @ManyToOne(() => DepartmentBudget, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'department_budget_id' })
  departmentBudget: DepartmentBudget;

  @Column({ type: 'smallint', name: 'threshold_percent' })
  thresholdPercent: number;

  @CreateDateColumn({ name: 'dispatched_at' })
  dispatchedAt: Date;
}
