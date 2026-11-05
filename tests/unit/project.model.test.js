const Project = require('../../src/modules/projects/project.model');
const ProjectMember = require('../../src/modules/projects/project-member.model');

describe('Project models', () => {
  test('defines tenant-scoped project lifecycle and validates the date range', async () => {
    const project = new Project({
      organizationId: 'aaaaaaaaaaaaaaaaaaaaaaaa',
      name: 'Launch',
      createdBy: 'bbbbbbbbbbbbbbbbbbbbbbbb',
      updatedBy: 'bbbbbbbbbbbbbbbbbbbbbbbb',
      startDate: new Date('2026-11-10'),
      dueDate: new Date('2026-11-01')
    });
    await expect(project.validate()).rejects.toMatchObject({ errors: { dueDate: expect.any(Object) } });
    expect(Project.schema.indexes().some(([fields]) => fields.organizationId === 1)).toBe(true);
  });

  test('allows only project Owner, Editor, and Viewer membership roles', async () => {
    const membership = new ProjectMember({
      organizationId: 'aaaaaaaaaaaaaaaaaaaaaaaa',
      projectId: 'cccccccccccccccccccccccc',
      userId: 'bbbbbbbbbbbbbbbbbbbbbbbb',
      addedBy: 'bbbbbbbbbbbbbbbbbbbbbbbb',
      role: 'Manager'
    });
    await expect(membership.validate()).rejects.toMatchObject({ errors: { role: expect.any(Object) } });
  });
});
