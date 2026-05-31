import db from '../db.js';
import { generateId } from '../utils.js';

const TrackingTypeModel = {
  getAll: () => db.getAll('trackingTypes'),
  get: (id) => db.get('trackingTypes', id),

  async create(data) {
    const type = {
      id: generateId(),
      name: String(data.name).trim(),
      description: data.description || '',
      icon: data.icon || '📍',
      color: data.color || '#6366f1',
      fields: data.fields || [],
      tags: data.tags || [],
      createdAt: new Date().toISOString(),
    };
    await db.put('trackingTypes', type);
    return type;
  },

  async update(id, data) {
    const existing = await db.get('trackingTypes', id);
    if (!existing) throw new Error(`TrackingType ${id} introuvable`);
    const updated = {
      ...existing,
      name: String(data.name).trim(),
      description: data.description ?? existing.description,
      icon: data.icon ?? existing.icon,
      color: data.color ?? existing.color,
      fields: data.fields ?? existing.fields,
      tags: data.tags ?? existing.tags,
      id,
    };
    await db.put('trackingTypes', updated);
    return updated;
  },

  delete: (id) => db.delete('trackingTypes', id),
};

export default TrackingTypeModel;
