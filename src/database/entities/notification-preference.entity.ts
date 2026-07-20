import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { User } from './user.entity';

@Entity('notification_preferences')
export class NotificationPreference {
  @Exclude({ toPlainOnly: true })
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'integer', name: 'user_id', unique: true })
  userId: number;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'boolean', name: 'email_enabled', default: true })
  emailEnabled: boolean;

  @Column({ type: 'boolean', name: 'in_app_enabled', default: true })
  inAppEnabled: boolean;

  @Column({ type: 'jsonb', name: 'type_preferences', default: {} })
  typePreferences: Record<string, { email?: boolean; inApp?: boolean }>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
