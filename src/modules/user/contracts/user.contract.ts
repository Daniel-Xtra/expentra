import type { SystemRoleName } from 'src/database/constants/system-roles';
import type { PermissionScope } from 'src/modules/authorization';
import type { IAuthUser } from 'src/definition';
import type { User } from 'src/database/entities/user.entity';
import type { EntityManager } from 'typeorm';
import type {
  AdminUpdateUserInput,
  CreateUserWithHashInput,
  ListUsersQuery,
  PaginatedUsersResult,
  SuspendUserInput,
  ChangePasswordInput,
  UpdateProfileInput,
} from '../types/user.types';
import type {
  UserDetailSummary,
  UserStatusCounts,
} from '../types/user-response.types';

export const USER_SERVICE = Symbol('USER_SERVICE');

export interface IUserService {
  findAllUsers(query: ListUsersQuery): Promise<PaginatedUsersResult>;
  getUserStatusCounts(): Promise<UserStatusCounts>;
  buildUsersExportCsv(query: ListUsersQuery): Promise<string>;
  getUserDetailSummary(reference: string): Promise<UserDetailSummary>;
  findOne(id: number): Promise<User>;
  findOneByReference(reference: string): Promise<User>;
  isUserDepartmentManager(userId: number): Promise<boolean>;
  getProfile(id: number): Promise<User>;
  updateProfile(id: number, input: UpdateProfileInput): Promise<User>;
  changePassword(id: number, input: ChangePasswordInput): Promise<void>;
  adminUpdate(
    actor: IAuthUser,
    targetUserId: number,
    input: AdminUpdateUserInput,
  ): Promise<User>;

  suspendUser(input: SuspendUserInput): Promise<User>;
  activateUser(input: SuspendUserInput): Promise<User>;
  findActiveUsersByRole(roleName: SystemRoleName): Promise<User[]>;
  findActiveUsersWithPermission(
    action: string,
    resource: string,
    scope?: PermissionScope,
  ): Promise<User[]>;
  findActiveUsersForExpenseApprovalNotification(
    departmentId: number | null | undefined,
  ): Promise<User[]>;
  findActiveUsersForFinanceQueueNotification(): Promise<User[]>;
  findManagedDepartmentIds(userId: number): Promise<number[]>;
  findDepartmentManagerUserIds(userIds: number[]): Promise<Set<number>>;
  findByEmail(email: string): Promise<User | null>;
  findByExternalIdentity(
    authProvider: string,
    externalId: string,
  ): Promise<User | null>;
  findAuthContext(reference: string): Promise<User | null>;
  markEmailVerified(id: number): Promise<void>;
  create(userData: Partial<User>): Promise<User>;
  createWithHash(
    data: CreateUserWithHashInput,
    manager?: EntityManager,
  ): Promise<User>;
  createSsoUser(data: {
    email: string;
    authProvider: string;
    externalId: string;
    firstName?: string;
    lastName?: string;
    avatarUrl?: string | null;
  }): Promise<User>;
  linkSsoIdentity(
    userId: number,
    data: {
      authProvider: string;
      externalId: string;
      avatarUrl?: string | null;
    },
  ): Promise<void>;
  syncSsoProfile(
    userId: number,
    data: { avatarUrl?: string | null },
  ): Promise<void>;
  updatePasswordHash(id: number, passwordHash: string): Promise<void>;
}
