const { createProjectService } = require('../../src/modules/projects/project.service');

const ORG_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const OWNER_ID = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const MEMBER_ID = 'cccccccccccccccccccccccc';
const PROJECT_ID = 'dddddddddddddddddddddddd';

function query(value) {
  const promise = Promise.resolve(value);
  promise.select = () => promise;
  promise.sort = () => promise;
  promise.skip = () => promise;
  promise.limit = () => promise;
  promise.lean = () => promise;
  return promise;
}

function transaction(work) {
  return work({ id: 'test-session' });
}

function createMemoryProjectModels() {
  const projects = [];
  const projectMembers = [];

  class ProjectModel {
    constructor(data) {
      Object.assign(this, data);
      this._id = PROJECT_ID;
      this.archivedAt ??= null;
    }
    async save(options) {
      this.session = options?.session;
      if (!projects.includes(this)) projects.push(this);
      return this;
    }
    static find(filter) { return query(projects.filter((item) => item.organizationId === filter.organizationId)); }
    static countDocuments(filter) { return Promise.resolve(projects.filter((item) => item.organizationId === filter.organizationId).length); }
    static findOne(filter) {
      return query(projects.find((item) => item._id === filter._id && item.organizationId === filter.organizationId) || null);
    }
    static findOneAndUpdate(filter, update) {
      const project = projects.find((item) => item._id === filter._id && item.organizationId === filter.organizationId &&
        (filter.archivedAt === undefined || (filter.archivedAt === null ? !item.archivedAt : Boolean(item.archivedAt))));
      if (project) Object.assign(project, update.$set);
      return Promise.resolve(project || null);
    }
    static deleteOne(filter) {
      const index = projects.findIndex((item) => item._id === filter._id && item.organizationId === filter.organizationId);
      if (index >= 0) projects.splice(index, 1);
      return Promise.resolve({ deletedCount: index >= 0 ? 1 : 0 });
    }
  }

  class ProjectMemberModel {
    constructor(data) { Object.assign(this, data); }
    async save(options) {
      this.session = options?.session;
      if (!projectMembers.includes(this)) projectMembers.push(this);
      return this;
    }
    static find(filter) {
      return query(projectMembers.filter((item) => item.organizationId === filter.organizationId && item.userId === filter.userId && item.status === filter.status));
    }
    static findOne(filter) {
      return query(projectMembers.find((item) => item.organizationId === filter.organizationId && item.projectId === filter.projectId && item.userId === filter.userId &&
        (!filter.status || item.status === filter.status)) || null);
    }
    static findOneAndUpdate(filter, update) {
      const member = projectMembers.find((item) => item.organizationId === filter.organizationId && item.projectId === filter.projectId && item.userId === filter.userId && item.status === filter.status);
      if (member) Object.assign(member, update.$set);
      return Promise.resolve(member || null);
    }
    static countDocuments(filter) {
      return Promise.resolve(projectMembers.filter((item) => item.organizationId === filter.organizationId && item.projectId === filter.projectId && item.status === filter.status).length);
    }
    static deleteMany(filter) {
      const before = projectMembers.length;
      for (let i = projectMembers.length - 1; i >= 0; i -= 1) {
        const item = projectMembers[i];
        if (item.organizationId === filter.organizationId && item.projectId === filter.projectId) projectMembers.splice(i, 1);
      }
      return Promise.resolve({ deletedCount: before - projectMembers.length });
    }
  }

  const OrganizationMemberModel = { findOne: jest.fn().mockResolvedValue({ status: 'active' }) };
  const UserModel = { find: () => query([]) };
  return { projects, projectMembers, ProjectModel, ProjectMemberModel, OrganizationMemberModel, UserModel };
}

describe('Project service', () => {
  test('creates a tenant-scoped project and grants its creator project Owner atomically', async () => {
    const models = createMemoryProjectModels();
    const runInTransaction = jest.fn(transaction);
    const service = createProjectService({ ...models, runInTransaction });
    const result = await service.create(ORG_ID, OWNER_ID, { name: 'Launch' });

    expect(runInTransaction).toHaveBeenCalledTimes(1);
    expect(result.project).toMatchObject({ organizationId: ORG_ID, name: 'Launch', createdBy: OWNER_ID });
    expect(result.membership).toMatchObject({ organizationId: ORG_ID, projectId: PROJECT_ID, userId: OWNER_ID, role: 'Owner', status: 'active' });
    expect(result.project.session).toBe(result.membership.session);
  });

  test('lists tenant projects with archived, search, and private-membership filters', async () => {
    const models = createMemoryProjectModels();
    const membershipFind = jest.spyOn(models.ProjectMemberModel, 'find');
    const projectFind = jest.spyOn(models.ProjectModel, 'find');
    const service = createProjectService(models);
    const result = await service.list(ORG_ID, 'Member', MEMBER_ID, {
      page: 2, limit: 10, q: 'plan.*', status: 'active', visibility: undefined, archived: false,
      dueAfter: undefined, dueBefore: undefined, sort: 'updatedAt', order: 'desc'
    });

    expect(result.pagination).toEqual({ page: 2, limit: 10, total: 0, totalPages: 0 });
    expect(membershipFind).toHaveBeenCalledWith({ organizationId: ORG_ID, userId: MEMBER_ID, status: 'active' });
    const filter = projectFind.mock.calls[0][0];
    expect(filter).toMatchObject({ organizationId: ORG_ID, archivedAt: null, status: 'active' });
    expect(filter.name.test('plan.*')).toBe(true);
    expect(filter.name.test('plan-anything')).toBe(false);
    expect(filter.$or).toEqual([
      { visibility: 'organization' },
      { _id: { $in: [] } }
    ]);
  });

  test('updates only allowed project fields, enforces date order, and blocks archived updates', async () => {
    const service = createProjectService();
    const project = { name: 'Before', startDate: new Date('2026-01-01'), dueDate: new Date('2026-02-01'), save: jest.fn() };
    await service.update(project, OWNER_ID, { name: 'After' });
    expect(project).toMatchObject({ name: 'After', updatedBy: OWNER_ID });
    await expect(service.update(project, OWNER_ID, { dueDate: new Date('2025-12-01') }))
      .rejects.toMatchObject({ code: 'INVALID_PROJECT_DATE_RANGE' });
    await expect(service.update({ ...project, archivedAt: new Date() }, OWNER_ID, { name: 'No' }))
      .rejects.toMatchObject({ code: 'PROJECT_ARCHIVED' });
  });

  test('archives and restores projects through atomic tenant-scoped updates', async () => {
    const models = createMemoryProjectModels();
    const project = new models.ProjectModel({ _id: PROJECT_ID, organizationId: ORG_ID, name: 'Archive me' });
    models.projects.push(project);
    const service = createProjectService({ ...models, clock: () => new Date('2026-11-05T00:00:00.000Z') });

    const archived = await service.archive(PROJECT_ID, ORG_ID, OWNER_ID);
    expect(archived.archivedAt).toEqual(new Date('2026-11-05T00:00:00.000Z'));
    expect(archived.archivedBy).toBe(OWNER_ID);
    const restored = await service.restore(PROJECT_ID, ORG_ID, OWNER_ID);
    expect(restored.archivedAt).toBeNull();
    expect(restored.archivedBy).toBeNull();
  });

  test('deletes project and membership data in one tenant-scoped transaction', async () => {
    const models = createMemoryProjectModels();
    const project = new models.ProjectModel({ _id: PROJECT_ID, organizationId: ORG_ID, name: 'Delete me' });
    models.projects.push(project);
    const runInTransaction = jest.fn(transaction);
    const memberDelete = jest.spyOn(models.ProjectMemberModel, 'deleteMany');
    const projectDelete = jest.spyOn(models.ProjectModel, 'deleteOne');
    const service = createProjectService({ ...models, runInTransaction });

    await service.remove(project, ORG_ID);
    expect(runInTransaction).toHaveBeenCalledTimes(1);
    expect(memberDelete).toHaveBeenCalledWith({ organizationId: ORG_ID, projectId: PROJECT_ID }, { session: { id: 'test-session' } });
    expect(projectDelete).toHaveBeenCalledWith({ organizationId: ORG_ID, _id: PROJECT_ID }, { session: { id: 'test-session' } });
  });

  test('adds only active organization members, changes project roles, and protects Owner membership', async () => {
    const models = createMemoryProjectModels();
    const service = createProjectService(models);
    const member = await service.addMember(ORG_ID, PROJECT_ID, OWNER_ID, MEMBER_ID, 'Viewer');
    expect(member).toMatchObject({ role: 'Viewer', status: 'active', addedBy: OWNER_ID });
    await expect(service.addMember(ORG_ID, PROJECT_ID, OWNER_ID, MEMBER_ID, 'Editor'))
      .rejects.toMatchObject({ code: 'ALREADY_A_PROJECT_MEMBER' });

    await service.updateMemberRole(ORG_ID, PROJECT_ID, MEMBER_ID, 'Editor');
    expect(member.role).toBe('Editor');
    member.role = 'Owner';
    await expect(service.removeMember(ORG_ID, PROJECT_ID, MEMBER_ID, OWNER_ID))
      .rejects.toMatchObject({ code: 'PROJECT_OWNER_PROTECTED' });
    member.role = 'Editor';
    const removed = await service.removeMember(ORG_ID, PROJECT_ID, MEMBER_ID, OWNER_ID);
    expect(removed).toMatchObject({ status: 'removed', removedBy: OWNER_ID });
  });
});
