export type CreateDelegationInput = {
  delegateReference: string;
  startsAt: Date;
  endsAt: Date;
};

export type ListDelegationsQuery = {
  page?: number;
  limit?: number;
};

export type PaginatedDelegationsResult = {
  data: import('src/database/entities/approval-delegation.entity').ApprovalDelegation[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type DelegationPersonResponse = {
  reference: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
};

export type DelegationResponse = {
  reference: string;
  delegatorReference: string;
  delegateReference: string;
  delegator: DelegationPersonResponse;
  delegate: DelegationPersonResponse;
  startsAt: Date;
  endsAt: Date;
  isActive: boolean;
  createdAt: Date;
};
