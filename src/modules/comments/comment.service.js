const mongoose = require('mongoose');
const Comment = require('./comment.model');
const OrganizationMember = require('../members/organization-member.model');
const ProjectMember = require('../projects/project-member.model');
const activityService = require('../activities/activity.service');
const notificationService = require('../notifications/notification.service');
const AppError = require('../../utils/app-error');
const withMongoTransaction = require('../../utils/mongo-transaction');
const { organizationScopedFilter } = require('../../utils/tenant-access');
const { paginationMetadata } = require('../../utils/pagination');

function createCommentService({
  CommentModel = Comment,
  OrganizationMemberModel = OrganizationMember,
  ProjectMemberModel = ProjectMember,
  ActivityService = activityService,
  NotificationService = notificationService,
  runInTransaction = withMongoTransaction,
  clock = () => new Date()
} = {}) {
  async function validateMentions(organizationId, project, mentions = [], session) {
    if (!mentions.length) return [];
    let memberQuery = OrganizationMemberModel.find(organizationScopedFilter(organizationId, {
      userId: mongoose.trusted({ $in: mentions }),
      status: 'active'
    }));
    if (session) memberQuery = memberQuery.session(session);
    const members = await memberQuery.select('userId role').lean();
    const memberById = new Map(members.map((member) => [String(member.userId), member]));
    const missing = mentions.filter((userId) => !memberById.has(String(userId)));
    if (missing.length) throw new AppError('Mentioned users must be active organization members', 404, 'COMMENT_MENTION_MEMBER_NOT_FOUND');

    if (project.visibility !== 'private') return members;
    const restrictedIds = mentions.filter((userId) => !['Owner', 'Admin', 'Manager'].includes(memberById.get(String(userId)).role));
    if (!restrictedIds.length) return members;
    let projectMemberQuery = ProjectMemberModel.find(organizationScopedFilter(organizationId, {
      projectId: project._id,
      userId: mongoose.trusted({ $in: restrictedIds }),
      status: 'active'
    }));
    if (session) projectMemberQuery = projectMemberQuery.session(session);
    const projectMembers = await projectMemberQuery.select('userId').lean();
    const projectMemberIds = new Set(projectMembers.map((member) => String(member.userId)));
    if (restrictedIds.some((userId) => !projectMemberIds.has(String(userId)))) {
      throw new AppError('Mentioned users must have access to this private project', 404, 'COMMENT_MENTION_MEMBER_NOT_FOUND');
    }
    return members;
  }

  async function notifyMentions({ organizationId, projectId, task, comment, actorId, mentions, session }) {
    for (const recipientId of mentions) {
      if (String(recipientId) === String(actorId)) continue;
      await NotificationService.create({
        organizationId,
        recipientId,
        actorId,
        category: 'mention',
        title: 'You were mentioned in a comment',
        message: `You were mentioned on task: ${task.title}`,
        projectId,
        taskId: task._id,
        sourceType: 'comment',
        sourceId: comment._id,
        link: `/api/v1/organizations/${organizationId}/projects/${projectId}/tasks/${task._id}/comments`,
        metadata: { commentId: comment._id }
      }, session);
    }
  }

  async function create({ organizationId, project, task, actorId, body, mentions = [] }) {
    return runInTransaction(async (session) => {
      const validMembers = await validateMentions(organizationId, project, mentions, session);
      const comment = new CommentModel({
        organizationId,
        projectId: project._id,
        taskId: task._id,
        authorId: actorId,
        body,
        mentions
      });
      await comment.save({ session });
      await ActivityService.record({
        organizationId,
        projectId: project._id,
        taskId: task._id,
        actorId,
        action: 'comment_created',
        targetType: 'comment',
        targetId: comment._id,
        metadata: { mentionCount: validMembers.length }
      }, session);
      await notifyMentions({ organizationId, projectId: project._id, task, comment, actorId, mentions, session });
      return comment;
    });
  }

  async function list(organizationId, projectId, taskId, { page, limit }) {
    const filter = organizationScopedFilter(organizationId, { projectId, taskId, deletedAt: null });
    const [comments, total] = await Promise.all([
      CommentModel.find(filter).sort({ createdAt: 1, _id: 1 }).skip((page - 1) * limit).limit(limit).lean(),
      CommentModel.countDocuments(filter)
    ]);
    return { comments, pagination: paginationMetadata(page, limit, total) };
  }

  async function update({ organizationId, project, task, commentId, actorId, changes }) {
    const scope = organizationScopedFilter(organizationId, {
      projectId: project._id,
      taskId: task._id,
      _id: commentId,
      deletedAt: null
    });
    const comment = await CommentModel.findOne(scope);
    if (!comment) throw new AppError('Comment not found', 404, 'COMMENT_NOT_FOUND');
    if (String(comment.authorId) !== String(actorId)) {
      throw new AppError('Only the comment author can edit this comment', 403, 'COMMENT_EDIT_FORBIDDEN');
    }

    let mentions = comment.mentions || [];
    const previousMentions = mentions.map(String);
    if (Object.hasOwn(changes, 'mentions')) mentions = changes.mentions;
    return runInTransaction(async (session) => {
      if (Object.hasOwn(changes, 'mentions')) {
        await validateMentions(organizationId, project, mentions, session);
      }
      if (Object.hasOwn(changes, 'body')) comment.body = changes.body;
      if (Object.hasOwn(changes, 'mentions')) comment.mentions = mentions;
      comment.editedAt = clock();
      await comment.save({ session });
      await ActivityService.record({
        organizationId,
        projectId: project._id,
        taskId: task._id,
        actorId,
        action: 'comment_updated',
        targetType: 'comment',
        targetId: comment._id,
        metadata: { changedFields: Object.keys(changes) }
      }, session);
      if (Object.hasOwn(changes, 'mentions')) {
        const previousMentionSet = new Set(previousMentions);
        const addedMentions = mentions.filter((userId) => !previousMentionSet.has(String(userId)));
        await notifyMentions({ organizationId, projectId: project._id, task, comment, actorId, mentions: addedMentions, session });
      }
      return comment;
    });
  }

  async function remove({ organizationId, project, task, commentId, actorId, organizationRole, projectRole }) {
    const comment = await CommentModel.findOne(organizationScopedFilter(organizationId, {
      projectId: project._id,
      taskId: task._id,
      _id: commentId,
      deletedAt: null
    }));
    if (!comment) throw new AppError('Comment not found', 404, 'COMMENT_NOT_FOUND');
    const author = String(comment.authorId) === String(actorId);
    const moderator = ['Owner', 'Admin', 'Manager'].includes(organizationRole) || projectRole === 'Owner';
    if (!author && !moderator) throw new AppError('You cannot delete this comment', 403, 'COMMENT_DELETE_FORBIDDEN');

    return runInTransaction(async (session) => {
      comment.deletedAt = clock();
      comment.deletedBy = actorId;
      await comment.save({ session });
      await ActivityService.record({
        organizationId,
        projectId: project._id,
        taskId: task._id,
        actorId,
        action: 'comment_deleted',
        targetType: 'comment',
        targetId: comment._id,
        metadata: { authorId: comment.authorId }
      }, session);
      return comment;
    });
  }

  return { create, list, update, remove, validateMentions };
}

module.exports = createCommentService();
module.exports.createCommentService = createCommentService;
