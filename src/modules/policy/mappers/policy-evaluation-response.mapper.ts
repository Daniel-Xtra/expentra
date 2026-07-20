import type {
  PolicyEvaluationResult,
  PolicyViolation,
} from '../types/policy.types';

export function toPolicyViolationResponse(violation: PolicyViolation) {
  return {
    policyReference: violation.policyReference,
    policyName: violation.policyName,
    ruleType: violation.ruleType,
    severity: violation.severity,
    message: violation.message,
  };
}

export function toPolicyEvaluationResponse(result: PolicyEvaluationResult) {
  return {
    violations: result.violations.map(toPolicyViolationResponse),
    blockingViolations: result.blockingViolations.map(
      toPolicyViolationResponse,
    ),
    warningViolations: result.warningViolations.map(toPolicyViolationResponse),
  };
}
