const Notification = require('./notification.model');
const AppError = require('../../utils/app-error');
const { organizationScopedFilter } = require('../../utils/tenant-access');
const { paginationMetadata } = require('../../utils/pagination');

function createNotificationService({ NotificationModel = Notification, clock = () => new Date() } = {}) {
  async function create(fields, session) {
    const notification = new NotificationModel(fields);
    await notification.save(session ? { session } : undefined);
    return notification;
  }

  async function createIdempotent(fields) {
    try {
      const result = await NotificationModel.updateOne(
        { dedupeKey: fields.dedupeKey },
        { $setOnInsert: fields },
        { upsert: true, runValidators: true, setDefaultsOnInsert: true }
      );
      return { created: Boolean(result.upsertedCount), result };
    } catch (error) {
      if (error.code === 11000) return { created: false, result: null };
      throw error;
    }
  }

  async function list(organizationId, recipientId, { page, limit, category, unreadOnly }) {
    const filter = organizationScopedFilter(organizationId, { recipientId });
    if (category) filter.category = category;
    if (unreadOnly) filter.readAt = null;
    const [notifications, total] = await Promise.all([
      NotificationModel.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      NotificationModel.countDocuments(filter)
    ]);
    return { notifications, pagination: paginationMetadata(page, limit, total) };
  }

  async function unreadCount(organizationId, recipientId) {
    return NotificationModel.countDocuments(organizationScopedFilter(organizationId, { recipientId, readAt: null }));
  }

  async function markRead(organizationId, recipientId, notificationId) {
    const scope = organizationScopedFilter(organizationId, { recipientId, _id: notificationId, readAt: null });
    const notification = await NotificationModel.findOneAndUpdate(
      scope,
      { $set: { readAt: clock() } },
      { new: true, runValidators: true }
    );
    if (notification) return notification;
    const existing = await NotificationModel.findOne(organizationScopedFilter(organizationId, {
      recipientId,
      _id: notificationId
    }));
    if (!existing) throw new AppError('Notification not found', 404, 'NOTIFICATION_NOT_FOUND');
    return existing;
  }

  async function markAllRead(organizationId, recipientId) {
    const result = await NotificationModel.updateMany(
      organizationScopedFilter(organizationId, { recipientId, readAt: null }),
      { $set: { readAt: clock() } }
    );
    return { modifiedCount: result.modifiedCount || 0 };
  }

  return { create, createIdempotent, list, unreadCount, markRead, markAllRead };
}

module.exports = createNotificationService();
module.exports.createNotificationService = createNotificationService;
