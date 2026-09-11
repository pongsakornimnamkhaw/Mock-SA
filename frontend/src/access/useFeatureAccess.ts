import { effectiveFeatureAccess, type BackofficeFeature } from './backofficeAccess';
import { getEmployeeSession } from '@/utils/employeeSession';

export function useFeatureAccess(feature: BackofficeFeature) {
  const session = getEmployeeSession();
  const level = session ? effectiveFeatureAccess(session.role, session.jobRole, session.department, feature) : 'none';
  return { level, canView: level === 'view' || level === 'edit', canEdit: level === 'edit' };
}
