'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

import { FaqsTab } from '@/components/features/content/FaqsTab';
import { LawsTab } from '@/components/features/content/LawsTab';
import { NewsTab } from '@/components/features/content/NewsTab';
import { TipsTab } from '@/components/features/content/TipsTab';
import { Spinner } from '@/components/ui/Spinner';
import { Tabs } from '@/components/ui/Tabs';

type ContentTab = 'laws' | 'faqs' | 'tips' | 'news';

const TAB_ITEMS = [
  { value: 'laws', label: 'Laws' },
  { value: 'faqs', label: 'FAQ' },
  { value: 'tips', label: 'Safety Tips' },
  { value: 'news', label: 'News' },
];

export default function ContentPage(): React.JSX.Element {
  return (
    <Suspense fallback={<Spinner />}>
      <ContentPageInner />
    </Suspense>
  );
}

function ContentPageInner(): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = (searchParams.get('tab') as ContentTab | null) ?? 'laws';

  const handleTabChange = (value: string): void => {
    router.push(`/content?tab=${value}`);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold text-deep-ink">Content</h1>
      <Tabs items={TAB_ITEMS} value={tab} onValueChange={handleTabChange} />
      {tab === 'laws' ? <LawsTab /> : null}
      {tab === 'faqs' ? <FaqsTab /> : null}
      {tab === 'tips' ? <TipsTab /> : null}
      {tab === 'news' ? <NewsTab /> : null}
    </div>
  );
}
