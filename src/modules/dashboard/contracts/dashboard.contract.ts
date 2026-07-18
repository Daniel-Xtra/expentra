import type { IAuthUser } from 'src/definition';
import type {
  DashboardPeriodQuery,
  PersonalDashboard,
  TeamDashboard,
} from '../types/dashboard.types';

export const DASHBOARD_SERVICE = Symbol('DASHBOARD_SERVICE');

export interface IDashboardService {
  getPersonalDashboard(
    authUser: IAuthUser,
    query: DashboardPeriodQuery,
  ): Promise<PersonalDashboard>;
  exportPersonalDashboardCsv(
    authUser: IAuthUser,
    query: DashboardPeriodQuery,
  ): Promise<string>;
  getTeamDashboardForDepartment(
    department: { id: number; reference: string; name: string },
    query: DashboardPeriodQuery,
  ): Promise<TeamDashboard>;
}
