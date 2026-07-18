import {
  Entity,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  UpdateDateColumn,
  PrimaryGeneratedColumn,
  ManyToMany,
  ManyToOne,
  JoinColumn,
  BeforeInsert,
  Unique,
} from 'typeorm';
import { Role } from './role.entity';
import { Exclude } from 'class-transformer';
import { ParentPermission } from './parent-permission.entity';
import { EntityReferencePrefix } from '../constants/entity-reference-prefix';
import { assignEntityReference } from '../helpers/entity-reference.util';
import {
  PermissionAction,
  PermissionResource,
  PermissionScope,
} from 'src/modules/authorization/constants/permissions';

@Entity('permissions')
@Unique(['resource', 'action', 'scope'])
export class Permission {
  @Exclude({ toPlainOnly: true })
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'reference', type: 'varchar', length: 36, unique: true })
  reference: string;

  @BeforeInsert()
  protected assignReference(): void {
    assignEntityReference(this, EntityReferencePrefix.PERMISSION);
  }

  @Column({ name: 'name' })
  name: string;

  @Column({ name: 'display_name', nullable: false, default: '' })
  displayName: string;

  @Column({
    type: 'varchar',
    name: 'resource',
    comment: 'The resource this permission applies to (e.g., Student, User)',
  })
  resource: PermissionResource;

  @Column({
    type: 'varchar',
    name: 'action',
    comment: 'The action this permission allows (e.g., create, read, update)',
  })
  action: PermissionAction;

  @Column({
    type: 'varchar',
    name: 'scope',
    default: PermissionScope.GLOBAL,
    comment: 'The scope of this permission (GLOBAL, SELF)',
  })
  scope: PermissionScope;

  @Exclude({ toPlainOnly: true })
  @Column({
    type: 'jsonb',
    nullable: true,
    comment:
      'Additional conditions for this permission (e.g., field restrictions)',
    name: 'conditions',
  })
  conditions?: Record<string, any>;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean;

  @Exclude({ toPlainOnly: true })
  @Column({ type: 'text', name: 'description', nullable: true })
  description?: string;

  @Exclude({ toPlainOnly: true })
  @Column({ type: 'jsonb', name: 'metadata', nullable: true })
  metadata?: Record<string, any>;

  @ManyToMany(() => Role, (role) => role.permissions)
  roles: Role[];

  @Column({
    type: 'integer',
    name: 'parent_permission_id',
    nullable: true,
  })
  parentPermissionId?: number;

  @ManyToOne(() => ParentPermission, (parent) => parent.permissions)
  @JoinColumn({ name: 'parent_permission_id' })
  parentPermission: ParentPermission;

  @Exclude({ toPlainOnly: true })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Exclude({ toPlainOnly: true })
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Exclude({ toPlainOnly: true })
  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt?: Date;

  get permissionString(): string {
    return `${this.action}:${this.resource}`;
  }

  get isGlobal(): boolean {
    return this.scope === PermissionScope.GLOBAL;
  }
}
