import { Timestamp } from 'firebase-admin/firestore';
import { describe, expect, it } from 'vitest';

import { serializeDoc } from '@/lib/firebase/serialize';

describe('serializeDoc', () => {
  it('converts Firestore Timestamp to an ISO string', (): void => {
    const fixedDate = new Date('2026-09-29T12:00:00.000Z');
    const timestamp = Timestamp.fromDate(fixedDate);

    const doc = {
      title: 'Emergency Tip',
      createdAt: timestamp,
    };

    const serialized = serializeDoc(doc);

    expect(serialized['title']).toBe('Emergency Tip');
    expect(serialized['createdAt']).toBe('2026-09-29T12:00:00.000Z');
  });

  it('converts multiple Timestamp fields in the same document', (): void => {
    const createdDate = new Date('2026-01-01T00:00:00.000Z');
    const updatedDate = new Date('2026-02-01T15:30:00.000Z');

    const doc = {
      id: 'tip-1',
      createdAt: Timestamp.fromDate(createdDate),
      updatedAt: Timestamp.fromDate(updatedDate),
    };

    const serialized = serializeDoc(doc);

    expect(serialized['createdAt']).toBe('2026-01-01T00:00:00.000Z');
    expect(serialized['updatedAt']).toBe('2026-02-01T15:30:00.000Z');
  });

  it('preserves primitive values, arrays, and nested non-Timestamp objects', (): void => {
    const doc = {
      id: 'incident-456',
      count: 5,
      isActive: true,
      tags: ['police', 'urgent'],
      metadata: { source: 'mobile-app', priority: 'high' },
    };

    const serialized = serializeDoc(doc);

    expect(serialized).toEqual({
      id: 'incident-456',
      count: 5,
      isActive: true,
      tags: ['police', 'urgent'],
      metadata: { source: 'mobile-app', priority: 'high' },
    });
  });

  it('returns an empty record when an empty object is provided', (): void => {
    const doc = {};
    const serialized = serializeDoc(doc);
    expect(serialized).toEqual({});
  });
});
