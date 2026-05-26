import db from '../db.js';

const TrackingEntryModel = {
  getAll: () => db.getAll('trackingEntries'),
  get: (id) => db.get('trackingEntries', id),

  async getByType(typeId) {
    const all = await db.getAll('trackingEntries');
    return all.filter(e => e.trackingTypeId === typeId);
  },

  async getInRange(startDate, endDate, typeId = null) {
    const all = await db.getAll('trackingEntries');
    const start = new Date(startDate);
    const end = new Date(endDate);
    return all.filter(e => {
      const ts = new Date(e.timestamp);
      const inRange = ts >= start && ts <= end;
      return typeId ? inRange && e.trackingTypeId === typeId : inRange;
    });
  },

  async create(data) {
    const entry = {
      id: crypto.randomUUID(),
      trackingTypeId: data.trackingTypeId,
      timestamp: data.timestamp || new Date().toISOString(),
      data: data.data || {},
      tags: data.tags || [],
      note: data.note || '',
    };
    await db.put('trackingEntries', entry);
    return entry;
  },

  async update(id, data) {
    const existing = await db.get('trackingEntries', id);
    if (!existing) throw new Error(`TrackingEntry ${id} introuvable`);
    const updated = { ...existing, ...data, id };
    await db.put('trackingEntries', updated);
    return updated;
  },

  delete: (id) => db.delete('trackingEntries', id),
};

export default TrackingEntryModel;
