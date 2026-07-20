import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { AuthUser } from 'src/core/decorators/auth-user.decorator';
import { EntityReferencePipe } from 'src/core/pipes/entity-reference.pipe';
import { successRequestResponse } from 'src/core/utils/helper';
import type { IAuthUser } from 'src/definition';
import { CheckPolicies } from 'src/modules/authorization';
import { canDecideOnApprovalAbility } from 'src/modules/authorization/policies/policy-handlers';
import {
  DELEGATION_SERVICE,
  type IDelegationService,
} from '../contracts/delegation.contract';
import { CreateDelegationDto } from '../dtos/create-delegation.dto';
import { ListDelegationsQueryDto } from '../dtos/list-delegations.query.dto';
import { toDelegationResponse } from '../mappers/delegation-response.mapper';

@Controller({ path: 'approval-delegations', version: '1' })
export class DelegationController {
  constructor(
    @Inject(DELEGATION_SERVICE)
    private readonly delegationService: IDelegationService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @CheckPolicies((ability) => canDecideOnApprovalAbility(ability))
  async create(
    @AuthUser() user: IAuthUser,
    @Body() payload: CreateDelegationDto,
  ) {
    const delegation = await this.delegationService.create(user, payload);
    return successRequestResponse(
      'Approval delegation created successfully',
      toDelegationResponse(delegation),
    );
  }

  @Get('mine')
  @HttpCode(HttpStatus.OK)
  @CheckPolicies((ability) => canDecideOnApprovalAbility(ability))
  async findMine(
    @AuthUser() user: IAuthUser,
    @Query() query: ListDelegationsQueryDto,
  ) {
    const result = await this.delegationService.findMine(user.id, query);
    return successRequestResponse(
      'Delegations retrieved successfully',
      result.data.map(toDelegationResponse),
      result.meta,
    );
  }

  @Get('delegated-to-me')
  @HttpCode(HttpStatus.OK)
  @CheckPolicies((ability) => canDecideOnApprovalAbility(ability))
  async findDelegatedToMe(
    @AuthUser() user: IAuthUser,
    @Query() query: ListDelegationsQueryDto,
  ) {
    const result = await this.delegationService.findDelegatedToMe(
      user.id,
      query,
    );
    return successRequestResponse(
      'Active delegations retrieved successfully',
      result.data.map(toDelegationResponse),
      result.meta,
    );
  }

  @Post(':reference/revoke')
  @HttpCode(HttpStatus.OK)
  @CheckPolicies((ability) => canDecideOnApprovalAbility(ability))
  async revoke(
    @AuthUser() user: IAuthUser,
    @Param('reference', EntityReferencePipe) reference: string,
  ) {
    await this.delegationService.revoke(user.id, reference);
    return successRequestResponse('Approval delegation revoked successfully');
  }
}
