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
import {
  ParentPermission } from './parent-permission.entity';
import { User } from './user.entity';
import { Exclude } from 'class-transformer';
import { EntityReferencePrefix } from '../constants/entity-reference-prefix';
import { assignEntityReference } from '../helpers/entity-reference.util';

@Entity('notifications')
export class Notification {
  @Exclude({ toPlainOnly: true })
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'reference', type: 'varchar', length: 36, unique: true })
  reference: string;

  @BeforeInsert()
  protected assignReference(): void {
    assignEntityReference(this, EntityReferencePrefix.NOTIFICATION);
  }

  @Column({ type: 'integer', name: 'user_id' })
  userId: number;

  @Column({
    type: 'integer',
    name: 'parent_permission_id',
    nullable: true,
  })
  parentPermissionId?: number;

  @ManyToOne(() => User, (user) => user.notifications, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 64 })
  type: string;

  @Column({
    type: 'varchar',
  })
  channel: string;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @Column({ type: 'varchar', default: 'PENDING' })
  status: string;

  @Exclude({ toPlainOnly: true })
  @ManyToOne(() => ParentPermission, (parent) => parent.permissions)
  @JoinColumn({ name: 'parent_permission_id' })
  parentPermission: ParentPermission;

  @Column({ type: 'timestamptz', name: 'sent_at', nullable: true })
  sentAt?: Date;

  @Column({ type: 'timestamptz', name: 'read_at', nullable: true })
  readAt?: Date | null;

  @Column({ type: 'text', name: 'error_message', nullable: true })
  errorMessage?: string;

  @Column({ type: 'jsonb', name: 'metadata', nullable: true })
  metadata?: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
