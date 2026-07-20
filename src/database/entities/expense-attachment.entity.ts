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
import { Expense } from './expense.entity';
import { User } from './user.entity';
import { Exclude } from 'class-transformer';
import { EntityReferencePrefix } from '../constants/entity-reference-prefix';
import { assignEntityReference } from '../helpers/entity-reference.util';

@Entity('expense_attachments')
export class ExpenseAttachment {
  @Exclude({ toPlainOnly: true })
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'reference', type: 'varchar', length: 36, unique: true })
  reference: string;

  @BeforeInsert()
  protected assignReference(): void {
    assignEntityReference(this, EntityReferencePrefix.EXPENSE_ATTACHMENT);
  }

  @Column({ type: 'integer', name: 'expense_id' })
  expenseId: number;

  @ManyToOne(() => Expense, (expense) => expense.attachments, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'expense_id' })
  expense: Expense;

  @Column({ name: 'file_name' })
  fileName: string;

  @Column({ name: 'mime_type' })
  mimeType: string;

  @Column({ type: 'integer', name: 'size_bytes' })
  sizeBytes: number;

  @Column({ name: 'object_key', length: 512 })
  objectKey: string;

  @Column({ name: 'resource_type', length: 16, default: 'image' })
  resourceType: string;

  @Column({ type: 'integer', name: 'uploaded_by_id' })
  uploadedById: number;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'uploaded_by_id' })
  uploadedBy: User;

  @Column({ type: 'jsonb', name: 'metadata', nullable: true })
  metadata?: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
