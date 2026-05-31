import db from '../db.js';
import { generateId } from '../utils.js';

const TagModel = {
  getAll: () => db.getAll('tags'),
  get: (id) => db.get('tags', id),

  async create(data) {
    const tag = {
      id: generateId(),
      name: String(data.name).trim(),
      color: data.color || '#6366f1',
      createdAt: new Date().toISOString(),
    };
    await db.put('tags', tag);
    return tag;
  },

  async update(id, data) {
    const existing = await db.get('tags', id);
    if (!existing) throw new Error(`Tag ${id} introuvable`);
    const updated = { ...existing, ...data, id };
    await db.put('tags', updated);
    return updated;
  },

  delete: (id) => db.delete('tags', id),
};

export default TagModel;
