import { beforeEach, describe, expect, it } from 'vitest';

import {
  createOrderedContent,
  deleteContent,
  applyPublishPatch,
  listOrderedContent,
  setContentPublished,
  toggleContentPublished,
  updateContent,
} from '@/lib/content/content.service';

import { resetFirestoreMocks, setCollectionDocs } from '../mocks/firebase-admin.mock';

interface SampleContent {
  readonly title: string;
  readonly order: number;
  readonly isPublished: boolean;
}

describe('Content Service', () => {
  const collectionName = 'safetyTips';

  beforeEach((): void => {
    resetFirestoreMocks();
  });

  describe('listOrderedContent', () => {
    it('returns an empty array when collection has no documents', async (): Promise<void> => {
      const items = await listOrderedContent<SampleContent>(collectionName);
      expect(items).toEqual([]);
    });

    it('returns all documents with IDs mapped', async (): Promise<void> => {
      setCollectionDocs(collectionName, [
        { id: 'tip-1', data: { title: 'First Aid Tip', order: 0, isPublished: true } },
        { id: 'tip-2', data: { title: 'Night Travel Tip', order: 1, isPublished: false } },
      ]);

      const items = await listOrderedContent<SampleContent>(collectionName);
      expect(items.length).toBe(2);
      expect(items[0]?.id).toBe('tip-1');
      expect(items[0]?.title).toBe('First Aid Tip');
      expect(items[1]?.id).toBe('tip-2');
      expect(items[1]?.title).toBe('Night Travel Tip');
    });
  });

  describe('createOrderedContent', () => {
    it('sets order to 0 when creating the first item in a collection', async (): Promise<void> => {
      const newId = await createOrderedContent(collectionName, {
        title: 'New Emergency Tip',
        isPublished: true,
      });

      expect(typeof newId).toBe('string');
      expect(newId.length).toBeGreaterThan(0);

      const items = await listOrderedContent<SampleContent>(collectionName);
      const created = items.find((item) => item.id === newId);
      expect(created?.order).toBe(0);
      expect(created?.title).toBe('New Emergency Tip');
    });

    it('increments maxOrder by 1 when documents already exist', async (): Promise<void> => {
      setCollectionDocs(collectionName, [
        { id: 'existing-1', data: { title: 'Existing Tip', order: 5, isPublished: true } },
      ]);

      const newId = await createOrderedContent(collectionName, {
        title: 'Subsequent Tip',
        isPublished: false,
      });

      const items = await listOrderedContent<SampleContent>(collectionName);
      const created = items.find((item) => item.id === newId);
      expect(created?.order).toBe(6);
    });
  });

  describe('updateContent', () => {
    it('updates specified fields on the target document', async (): Promise<void> => {
      setCollectionDocs(collectionName, [
        { id: 'tip-update', data: { title: 'Old Title', order: 2, isPublished: true } },
      ]);

      await updateContent(collectionName, 'tip-update', {
        title: 'Updated Title',
      });

      const items = await listOrderedContent<SampleContent>(collectionName);
      const updated = items.find((item) => item.id === 'tip-update');
      expect(updated?.title).toBe('Updated Title');
      expect(updated?.order).toBe(2);
    });
  });

  describe('deleteContent', () => {
    it('deletes document by ID', async (): Promise<void> => {
      setCollectionDocs(collectionName, [
        { id: 'tip-delete-1', data: { title: 'To Delete', order: 0, isPublished: false } },
        { id: 'tip-keep-2', data: { title: 'To Keep', order: 1, isPublished: true } },
      ]);

      await deleteContent(collectionName, 'tip-delete-1');

      const items = await listOrderedContent<SampleContent>(collectionName);
      expect(items.length).toBe(1);
      expect(items[0]?.id).toBe('tip-keep-2');
    });
  });

  describe('toggleContentPublished', () => {
    it('toggles isPublished from true to false', async (): Promise<void> => {
      setCollectionDocs(collectionName, [
        { id: 'toggle-1', data: { title: 'Tip A', order: 0, isPublished: true } },
      ]);

      const result = await toggleContentPublished(collectionName, 'toggle-1');
      expect(result).toBe(false);

      const items = await listOrderedContent<SampleContent>(collectionName);
      expect(items[0]?.isPublished).toBe(false);
    });

    it('toggles isPublished from false to true when unset or false', async (): Promise<void> => {
      setCollectionDocs(collectionName, [
        { id: 'toggle-2', data: { title: 'Tip B', order: 0, isPublished: false } },
      ]);

      const result = await toggleContentPublished(collectionName, 'toggle-2');
      expect(result).toBe(true);

      const items = await listOrderedContent<SampleContent>(collectionName);
      expect(items[0]?.isPublished).toBe(true);
    });
  });

  describe('setContentPublished', () => {
    it('writes the requested state without reading first', async (): Promise<void> => {
      setCollectionDocs(collectionName, [
        { id: 'set-1', data: { title: 'Tip C', order: 0, isPublished: true } },
      ]);

      await expect(setContentPublished(collectionName, 'set-1', true)).resolves.toBe(true);

      const items = await listOrderedContent<SampleContent>(collectionName);
      expect(items[0]?.isPublished).toBe(true);
    });
  });

  describe('applyPublishPatch', () => {
    const patch = (body?: unknown): Request =>
      new Request('http://localhost/api/content/tips/x', {
        method: 'PATCH',
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });

    it('sets the target state sent by the client', async (): Promise<void> => {
      setCollectionDocs(collectionName, [
        { id: 'p-1', data: { title: 'Tip D', order: 0, isPublished: false } },
      ]);

      await expect(
        applyPublishPatch(patch({ isPublished: true }), collectionName, 'p-1'),
      ).resolves.toBe(true);
      const items = await listOrderedContent<SampleContent>(collectionName);
      expect(items[0]?.isPublished).toBe(true);
    });

    it('falls back to a toggle for a request without a body', async (): Promise<void> => {
      setCollectionDocs(collectionName, [
        { id: 'p-2', data: { title: 'Tip E', order: 0, isPublished: true } },
      ]);

      await expect(applyPublishPatch(patch(), collectionName, 'p-2')).resolves.toBe(false);
    });

    it('falls back to a toggle when isPublished is not a boolean', async (): Promise<void> => {
      setCollectionDocs(collectionName, [
        { id: 'p-3', data: { title: 'Tip F', order: 0, isPublished: false } },
      ]);

      await expect(
        applyPublishPatch(patch({ isPublished: 'yes' }), collectionName, 'p-3'),
      ).resolves.toBe(true);
    });
  });
});
