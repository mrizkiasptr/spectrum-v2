import { useAuth } from '../auth/AuthProvider';
import type { Project } from '../domain/types';
import { Icon } from './Icon';

/** People with tribe access can follow a project; only its members (and admins) can change it. */
export function ViewOnlyBanner({ project }: { project: Project }) {
  const { access, workspace } = useAuth();
  if (!workspace || access.isAdmin || (access.memberId && project.memberIds.includes(access.memberId))) return null;
  return (
    <div className="banner page-banner" role="note">
      <Icon name="info" size={16} />
      <span>
        <strong>View only.</strong> You can follow {project.name} through tribe {project.tribe}. Ask a project member or an admin to add you to
        the team to make changes.
      </span>
    </div>
  );
}
