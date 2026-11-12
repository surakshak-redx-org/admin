'use client';

import { Bell } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';

import { NEW_INCIDENT_TOAST_DURATION_MS } from '@/constants/config';
import { useNewIncidentPoll } from '@/hooks';
import { cn } from '@/lib/utils';
import type { NewIncidentSummary } from '@/services/incidents.service';

const INCIDENTS_PATH = '/incidents';
const UNKNOWN_REPORTER_LABEL = 'a user';
const UNTITLED_LABEL = 'Untitled incident';

interface NewIncidentToastProps {
  incident: NewIncidentSummary;
  visible: boolean;
  onOpen: () => void;
}

function NewIncidentToast({ incident, visible, onOpen }: NewIncidentToastProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Open incidents"
      className={cn(
        'flex w-80 items-start gap-3 rounded-lg border border-error-red/30 bg-white p-4 text-left shadow-lg transition-opacity',
        visible ? 'opacity-100' : 'opacity-0',
      )}
    >
      <Bell className="mt-0.5 h-5 w-5 shrink-0 text-error-red" />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-deep-ink">New Incident Reported</span>
        <span className="block truncate text-sm text-deep-ink">
          {incident.title || UNTITLED_LABEL}
        </span>
        <span className="block truncate text-xs text-stone">
          Reported by {incident.reporterName ?? UNKNOWN_REPORTER_LABEL}
        </span>
      </span>
    </button>
  );
}

/**
 * Renders nothing; shows a clickable toast for each newly reported incident.
 * Clicking a toast opens the Incidents page.
 */
export function NewIncidentNotifier(): null {
  const router = useRouter();
  const newIncidents = useNewIncidentPoll();
  const announcedIds = useRef<Set<string>>(new Set());

  useEffect((): void => {
    if (!newIncidents) return;

    // Oldest first, so the newest report ends up on top of the toast stack.
    [...newIncidents].reverse().forEach((incident): void => {
      if (announcedIds.current.has(incident.id)) return;
      announcedIds.current.add(incident.id);

      toast.custom(
        (t): React.JSX.Element => (
          <NewIncidentToast
            incident={incident}
            visible={t.visible}
            onOpen={(): void => {
              toast.dismiss(t.id);
              router.push(INCIDENTS_PATH);
            }}
          />
        ),
        { id: `new-incident-${incident.id}`, duration: NEW_INCIDENT_TOAST_DURATION_MS },
      );
    });
  }, [newIncidents, router]);

  return null;
}
