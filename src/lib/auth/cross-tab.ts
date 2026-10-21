import { AUTH_BROADCAST_CHANNEL, AUTH_SIGNED_OUT_MESSAGE } from '@/constants/config';

function openChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  return new BroadcastChannel(AUTH_BROADCAST_CHANNEL);
}

/** Tells every other open admin tab that this tab just signed out. */
export function broadcastSignOut(): void {
  const channel = openChannel();
  if (!channel) return;
  channel.postMessage(AUTH_SIGNED_OUT_MESSAGE);
  channel.close();
}

/**
 * Calls `onSignOut` when another tab signs out. Firebase also syncs auth state across
 * tabs, but only on a polling delay; this makes the other tabs stop immediately.
 *
 * @returns Function that stops listening
 */
export function subscribeToSignOut(onSignOut: () => void): () => void {
  const channel = openChannel();
  if (!channel) return (): void => undefined;

  const handleMessage = (event: MessageEvent<unknown>): void => {
    if (event.data === AUTH_SIGNED_OUT_MESSAGE) onSignOut();
  };
  channel.addEventListener('message', handleMessage);

  return (): void => {
    channel.removeEventListener('message', handleMessage);
    channel.close();
  };
}
