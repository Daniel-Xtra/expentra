import { successRequestResponse } from 'src/core/utils/helper';
import type { QueuedExportResult } from '../types/export.types';

export function exportQueuedResponse(result: QueuedExportResult) {
  return successRequestResponse(
    'You will receive an email with the file when it is ready.',
    {
      status: result.status,
      jobType: result.jobType,
    },
  );
}
