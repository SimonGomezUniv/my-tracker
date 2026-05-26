import db from '../db.js';

const TrackingGroupModel = {
  getAll: () => db.getAll('trackingGroups'),
  get: (id) => db.get('trackingGroups', id),

  async create(data) {
    const group = {
      id: crypto.randomUUID(),
      name: String(data.name).trim(),
      description: data.description || '',
      icon: data.icon || '📁',
      color: data.color || '#6366f1',
      trackingTypeIds: data.trackingTypeIds || [],
      tags: data.tags || [],
      createdAt: new Date().toISOString(),
    };
    await db.put('trackingGroups', group);
    return group;
  },

  async update(id, data) {
    const existing = await db.get('trackingGroups', id);
    if (!existing) throw new Error(`TrackingGroup ${id} introuvable`);
    const updated = {
      ...existing,
      name: String(data.name).trim(),
      description: data.description ?? existing.description,
      icon: data.icon ?? existing.icon,
      color: data.color ?? existing.color,
      trackingTypeIds: data.trackingTypeIds ?? existing.trackingTypeIds,
      tags: data.tags ?? existing.tags,
      id,
    };
    await db.put('trackingGroups', updated);
    return updated;
  },

  delete: (id) => db.delete('trackingGroups', id),
};

export default TrackingGroupModel;
