import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { EntityReferencePipe } from 'src/core/pipes/entity-reference.pipe';
import { successRequestResponse } from 'src/core/utils/helper';
import {
  PermissionAction,
  PermissionResource,
  RequirePermission,
} from 'src/modules/authorization';
import {
  EXPENSE_POLICY_SERVICE,
  type IExpensePolicyService,
} from '../contracts/policy.contract';
import { CreateExpensePolicyDto } from '../dtos/create-expense-policy.dto';
import { UpdateExpensePolicyDto } from '../dtos/update-expense-policy.dto';
import { toExpensePolicyResponse } from '../mappers/policy-response.mapper';

@Controller({ path: 'policies', version: '1' })
export class PolicyController {
  constructor(
    @Inject(EXPENSE_POLICY_SERVICE)
    private readonly policyService: IExpensePolicyService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission(PermissionAction.CREATE, PermissionResource.POLICY)
  async create(@Body() payload: CreateExpensePolicyDto) {
    const policy = await this.policyService.create(payload);
    return successRequestResponse(
      'Expense policy created successfully',
      toExpensePolicyResponse(policy),
    );
  }

  @Get(['', 'all'])
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PermissionAction.READ, PermissionResource.POLICY)
  async findAll() {
    const policies = await this.policyService.findAll();
    return successRequestResponse(
      'Expense policies retrieved successfully',
      policies.map(toExpensePolicyResponse),
    );
  }

  @Patch(':reference')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PermissionAction.UPDATE, PermissionResource.POLICY)
  async update(
    @Param('reference', EntityReferencePipe) reference: string,
    @Body() payload: UpdateExpensePolicyDto,
  ) {
    const policy = await this.policyService.update(reference, payload);
    return successRequestResponse(
      'Expense policy updated successfully',
      toExpensePolicyResponse(policy),
    );
  }

  @Delete(':reference')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PermissionAction.DELETE, PermissionResource.POLICY)
  async remove(@Param('reference', EntityReferencePipe) reference: string) {
    await this.policyService.remove(reference);
    return successRequestResponse('Expense policy deleted successfully');
  }
}
