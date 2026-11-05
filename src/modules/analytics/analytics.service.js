const mongoose = require('mongoose');
const Task = require('../tasks/task.model');
const Project = require('../projects/project.model');
const OrganizationMember = require('../members/organization-member.model');

function toObjectId(id) {
  return id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(String(id));
}

function percentage(part, total) {
  return total ? Math.round((part / total) * 1000) / 10 : 0;
}

function createAnalyticsService({
  TaskModel = Task,
  ProjectModel = Project,
  MemberModel = OrganizationMember,
  clock = () => new Date()
} = {}) {
  async function summarize(organizationId, options = {}) {
    const orgId = toObjectId(organizationId);
    const match = { organizationId: orgId };
    if (options.projectId) match.projectId = toObjectId(options.projectId);
    const createdAtRange = {};
    if (options.from) createdAtRange.$gte = options.from;
    if (options.to) createdAtRange.$lte = options.to;
    const creationRangeStages = Object.keys(createdAtRange).length ? [{ $match: { createdAt: createdAtRange } }] : [];
    const now = clock();
    const granularity = options.granularity || 'day';
    const completedAt = { $ne: null };
    if (options.from) completedAt.$gte = options.from;
    if (options.to) completedAt.$lte = options.to;

    const pipeline = [
      { $match: match },
      { $facet: {
        overview: [...creationRangeStages, { $group: {
          _id: null,
          totalTasks: { $sum: 1 },
          completedTasks: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } },
          overdueTasks: { $sum: { $cond: [{ $and: [
            { $ne: ['$dueDate', null] },
            { $lt: ['$dueDate', now] },
            { $not: [{ $in: ['$status', ['done', 'cancelled']] }] }
          ] }, 1, 0] } }
        } }],
        byStatus: [...creationRangeStages,
          { $group: { _id: '$status', count: { $sum: 1 } } },
          { $sort: { _id: 1 } }
        ],
        byPriority: [...creationRangeStages,
          { $group: { _id: '$priority', count: { $sum: 1 } } },
          { $sort: { _id: 1 } }
        ],
        projects: [...creationRangeStages,
          { $group: {
            _id: '$projectId',
            totalTasks: { $sum: 1 },
            completedTasks: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } },
            overdueTasks: { $sum: { $cond: [{ $and: [
              { $ne: ['$dueDate', null] },
              { $lt: ['$dueDate', now] },
              { $not: [{ $in: ['$status', ['done', 'cancelled']] }] }
            ] }, 1, 0] } }
          } },
          { $sort: { totalTasks: -1, _id: 1 } }
        ],
        unassignedTasks: [...creationRangeStages,
          { $match: { assigneeId: null } },
          { $count: 'count' }
        ],
        memberWorkload: [...creationRangeStages,
          { $match: { assigneeId: { $ne: null } } },
          { $group: {
            _id: '$assigneeId',
            assignedTasks: { $sum: 1 },
            completedTasks: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } },
            overdueTasks: { $sum: { $cond: [{ $and: [
              { $ne: ['$dueDate', null] },
              { $lt: ['$dueDate', now] },
              { $not: [{ $in: ['$status', ['done', 'cancelled']] }] }
            ] }, 1, 0] } }
          } },
          { $sort: { assignedTasks: -1, _id: 1 } }
        ],
        productivity: [
          { $match: { status: 'done', completedAt } },
          { $group: {
            _id: { $dateTrunc: { date: '$completedAt', unit: granularity, timezone: 'UTC' } },
            completedTasks: { $sum: 1 }
          } },
          { $sort: { _id: 1 } }
        ]
      } }
    ];

    const [facets = {}] = await TaskModel.aggregate(pipeline);
    const overview = facets.overview?.[0] || { totalTasks: 0, completedTasks: 0, overdueTasks: 0 };
    const [activeProjects, activeMembers] = options.projectId
      ? [1, undefined]
      : await Promise.all([
        ProjectModel.countDocuments({ organizationId: orgId, archivedAt: null }),
        MemberModel.countDocuments({ organizationId: orgId, status: 'active' })
      ]);

    return {
      scope: options.projectId ? 'project' : 'organization',
      projectId: options.projectId ? String(options.projectId) : undefined,
      dateRange: { from: options.from || null, to: options.to || null, granularity },
      overview: {
        totalTasks: overview.totalTasks || 0,
        completedTasks: overview.completedTasks || 0,
        completionRate: percentage(overview.completedTasks || 0, overview.totalTasks || 0),
        overdueTasks: overview.overdueTasks || 0,
        unassignedTasks: facets.unassignedTasks?.[0]?.count || 0,
        ...(options.projectId ? {} : { activeProjects, activeMembers })
      },
      taskDistribution: {
        byStatus: facets.byStatus || [],
        byPriority: facets.byPriority || []
      },
      projects: (facets.projects || []).map((item) => ({
        projectId: item._id,
        totalTasks: item.totalTasks,
        completedTasks: item.completedTasks,
        completionRate: percentage(item.completedTasks, item.totalTasks),
        overdueTasks: item.overdueTasks
      })),
      memberWorkload: (facets.memberWorkload || []).map((item) => ({
        memberId: item._id,
        assignedTasks: item.assignedTasks,
        completedTasks: item.completedTasks,
        completionRate: percentage(item.completedTasks, item.assignedTasks),
        overdueTasks: item.overdueTasks
      })),
      productivity: (facets.productivity || []).map((item) => ({ date: item._id, completedTasks: item.completedTasks }))
    };
  }

  async function organization(organizationId, options) {
    return summarize(organizationId, options);
  }

  async function project(organizationId, projectId, options) {
    return summarize(organizationId, { ...options, projectId });
  }

  return { organization, project, summarize };
}

module.exports = createAnalyticsService();
module.exports.createAnalyticsService = createAnalyticsService;
module.exports.percentage = percentage;
