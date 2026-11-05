const mongoose = require('mongoose');
const Task = require('../../src/modules/tasks/task.model');
const Project = require('../../src/modules/projects/project.model');
const Invitation = require('../../src/modules/invitations/invitation.model');

const ORG_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';

describe('Mongoose query sanitization', () => {
  const previous = mongoose.get('sanitizeFilter');
  beforeAll(() => mongoose.set('sanitizeFilter', true));
  afterAll(() => mongoose.set('sanitizeFilter', previous));

  test('allows only explicitly trusted server-side operators in typed queries', () => {
    const dueTasks = Task.find({
      organizationId: ORG_ID,
      status: mongoose.trusted({ $nin: ['done', 'cancelled'] }),
      dueDate: mongoose.trusted({ $ne: null, $lte: new Date('2026-11-05T00:00:00Z') })
    });
    dueTasks._castConditions();
    expect(dueTasks.error()).toBeUndefined();

    const projectList = Project.find({
      organizationId: ORG_ID,
      dueDate: mongoose.trusted({ $gte: new Date('2026-01-01'), $lte: new Date('2026-12-31') }),
      _id: mongoose.trusted({ $in: [] })
    });
    projectList._castConditions();
    expect(projectList.error()).toBeUndefined();

    const invitations = Invitation.find({ expiresAt: mongoose.trusted({ $gt: new Date() }) });
    invitations._castConditions();
    expect(invitations.error()).toBeUndefined();
  });

  test('rejects untrusted query operators rather than casting them as values', () => {
    const query = Task.find({ status: { $nin: ['done', 'cancelled'] } });
    query._castConditions();
    expect(query.error()).toBeInstanceOf(mongoose.Error.CastError);
  });
});
