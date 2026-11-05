const ACTIONS = Object.freeze([
  'organization_created', 'organization_updated',
  'project_created', 'project_updated', 'project_archived', 'project_restored', 'project_deleted',
  'member_joined', 'member_role_changed', 'member_removed',
  'project_member_added', 'project_member_role_changed', 'project_member_removed',
  'invitation_created', 'invitation_revoked', 'invitation_accepted',
  'task_created', 'task_updated', 'task_status_changed', 'task_assigned', 'task_deleted',
  'comment_created', 'comment_updated', 'comment_deleted'
]);

const TARGET_TYPES = Object.freeze([
  'organization', 'project', 'organization_member', 'project_member',
  'invitation', 'task', 'comment'
]);

module.exports = { ACTIONS, TARGET_TYPES };
