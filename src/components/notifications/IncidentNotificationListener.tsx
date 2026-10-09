'use client';

import { useRouter } from 'next/navigation';
import type React from 'react';
import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';

import { useAuth } from '@/lib/auth/session';

interface ClientIncident {
  id: string;
  title: string;
  createdAt: string;
  user: { name: string; city: string } | null;
}

interface IncidentsResponse {
  data?: ClientIncident[];
  incidents?: ClientIncident[];
}

export function IncidentNotificationListener(): React.JSX.Element | null {
  const { idToken, isAdmin, isLoading } = useAuth();
  const router = useRouter();
  const initializedRef = useRef(false);
  const knownIncidentIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (isLoading || !isAdmin || !idToken) {
      initializedRef.current = false;
      knownIncidentIdsRef.current.clear();
      return;
    }

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const checkForIncidents = async (): Promise<void> => {
      try {
        const response = await fetch('/api/incidents', {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
          cache: 'no-store',
        });

        if (!response.ok) {
          throw new Error('Unable to check for new incidents');
        }

        const payload = (await response.json()) as
          | ClientIncident[]
          | IncidentsResponse;

        const incidents = Array.isArray(payload)
          ? payload
          : (payload.data ?? payload.incidents ?? []);

        if (cancelled) return;

        if (!initializedRef.current) {
          knownIncidentIdsRef.current = new Set(
            incidents.map((incident) => incident.id),
          );
          initializedRef.current = true;
          return;
        }

        const newIncidents = incidents.filter(
          (incident) => !knownIncidentIdsRef.current.has(incident.id),
        );

        for (const incident of newIncidents) {
          knownIncidentIdsRef.current.add(incident.id);

          const reporter = incident.user?.name || 'Unknown reporter';
          const title = incident.title || 'Untitled incident';

          toast(
            (t): React.JSX.Element => (
              <button
                type="button"
                className="w-full text-left"
                onClick={(): void => {
                  toast.dismiss(t.id);
                  router.push('/incidents');
                }}
              >
                <span className="block font-semibold">
                  New Incident Reported
                </span>
                <span className="block text-sm">{title}</span>
                <span className="block text-xs text-gray-500">
                  Reporter: {reporter}
                </span>
                <span className="block text-xs text-blue-600">
                  Click to view incidents
                </span>
              </button>
            ),
            { duration: 8000, id: `incident-${incident.id}` },
          );
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Incident notification check failed:', error);
        }
      } finally {
        if (!cancelled) {
          timeoutId = setTimeout((): void => {
            void checkForIncidents();
          }, 15_000);
        }
      }
    };

    void checkForIncidents();

    return (): void => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [idToken, isAdmin, isLoading, router]);

  return null;
}
