const { paginationSchema } = require('../../src/modules/activities/activity.validation');

describe('Activity filter validation', () => {
  test('accepts bounded and single-sided ISO date ranges', () => {
    expect(paginationSchema.validate({ from: '2026-01-01T00:00:00.000Z', to: '2026-02-01T00:00:00.000Z' }).error).toBeUndefined();
    expect(paginationSchema.validate({ from: '2026-01-01T00:00:00.000Z' }).error).toBeUndefined();
    expect(paginationSchema.validate({ to: '2026-02-01T00:00:00.000Z' }).error).toBeUndefined();
  });

  test('rejects reversed dates and malformed dates', () => {
    expect(paginationSchema.validate({ from: '2026-02-01T00:00:00.000Z', to: '2026-01-01T00:00:00.000Z' }).error)
      .toMatchObject({ details: [expect.objectContaining({ message: 'from must be earlier than or equal to to' })] });
    expect(paginationSchema.validate({ from: 'yesterday' }).error).toBeDefined();
  });
});
