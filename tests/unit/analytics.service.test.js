const mongoose = require('mongoose');
const { createAnalyticsService } = require('../../src/modules/analytics/analytics.service');

const ORG_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const PROJECT_ID = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const MEMBER_ID = 'cccccccccccccccccccccccc';
const NOW = new Date('2026-11-05T12:00:00Z');

describe('Analytics service', () => {
  test('aggregates organization task distribution, completion, workload, overdue tasks, and productivity', async () => {
    const facets = {
      overview: [{ totalTasks: 4, completedTasks: 2, overdueTasks: 1 }],
      byStatus: [{ _id: 'done', count: 2 }, { _id: 'todo', count: 2 }],
      byPriority: [{ _id: 'high', count: 1 }, { _id: 'medium', count: 3 }],
      projects: [{ _id: PROJECT_ID, totalTasks: 4, completedTasks: 2, overdueTasks: 1 }],
      unassignedTasks: [{ count: 1 }],
      memberWorkload: [{ _id: MEMBER_ID, assignedTasks: 1, completedTasks: 0, overdueTasks: 0 }],
      productivity: [{ _id: new Date('2026-11-05T00:00:00Z'), completedTasks: 2 }]
    };
    const TaskModel = { aggregate: jest.fn().mockResolvedValue([facets]) };
    const ProjectModel = { countDocuments: jest.fn().mockResolvedValue(3) };
    const MemberModel = { countDocuments: jest.fn().mockResolvedValue(5) };
    const service = createAnalyticsService({ TaskModel, ProjectModel, MemberModel, clock: () => NOW });

    const from = new Date('2026-11-01T00:00:00Z');
    const to = new Date('2026-11-30T23:59:59Z');
    const result = await service.organization(ORG_ID, { from, to, granularity: 'day' });

    expect(result).toMatchObject({
      scope: 'organization',
      overview: { totalTasks: 4, completedTasks: 2, completionRate: 50, overdueTasks: 1, unassignedTasks: 1, activeProjects: 3, activeMembers: 5 },
      taskDistribution: { byStatus: facets.byStatus, byPriority: facets.byPriority },
      projects: [{ projectId: PROJECT_ID, totalTasks: 4, completedTasks: 2, completionRate: 50, overdueTasks: 1 }],
      memberWorkload: [{ memberId: MEMBER_ID, assignedTasks: 1, completionRate: 0 }],
      productivity: [{ date: new Date('2026-11-05T00:00:00Z'), completedTasks: 2 }]
    });
    const pipeline = TaskModel.aggregate.mock.calls[0][0];
    const match = pipeline[0].$match;
    expect(match.organizationId).toBeInstanceOf(mongoose.Types.ObjectId);
    expect(String(match.organizationId)).toBe(ORG_ID);
    expect(pipeline[1].$facet.overview[0].$match.createdAt).toEqual({ $gte: from, $lte: to });
    expect(pipeline[1].$facet.productivity[0].$match.completedAt).toEqual({ $ne: null, $gte: from, $lte: to });
    expect(ProjectModel.countDocuments).toHaveBeenCalledWith({ organizationId: match.organizationId, archivedAt: null });
    expect(MemberModel.countDocuments).toHaveBeenCalledWith({ organizationId: match.organizationId, status: 'active' });
  });

  test('scopes project analytics to both tenant and project and returns zero-safe rates', async () => {
    const TaskModel = { aggregate: jest.fn().mockResolvedValue([{}]) };
    const ProjectModel = { countDocuments: jest.fn() };
    const MemberModel = { countDocuments: jest.fn() };
    const service = createAnalyticsService({ TaskModel, ProjectModel, MemberModel, clock: () => NOW });
    const result = await service.project(ORG_ID, PROJECT_ID, { granularity: 'week' });

    expect(result).toMatchObject({
      scope: 'project',
      projectId: PROJECT_ID,
      overview: { totalTasks: 0, completedTasks: 0, completionRate: 0, overdueTasks: 0 },
      taskDistribution: { byStatus: [], byPriority: [] },
      projects: [], memberWorkload: [], productivity: []
    });
    const match = TaskModel.aggregate.mock.calls[0][0][0].$match;
    expect(String(match.organizationId)).toBe(ORG_ID);
    expect(String(match.projectId)).toBe(PROJECT_ID);
    expect(ProjectModel.countDocuments).not.toHaveBeenCalled();
    expect(MemberModel.countDocuments).not.toHaveBeenCalled();
  });
});
