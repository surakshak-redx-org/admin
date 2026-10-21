import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AUTH_BROADCAST_CHANNEL, AUTH_SIGNED_OUT_MESSAGE } from '@/constants/config';
import { broadcastSignOut, subscribeToSignOut } from '@/lib/auth/cross-tab';

type MessageListener = (event: MessageEvent<unknown>) => void;

/** In-memory stand-in: a message reaches every other open channel with the same name. */
class FakeBroadcastChannel {
  static instances: FakeBroadcastChannel[] = [];

  private readonly listeners = new Set<MessageListener>();
  private closed = false;

  constructor(readonly name: string) {
    FakeBroadcastChannel.instances.push(this);
  }

  postMessage(data: unknown): void {
    for (const other of FakeBroadcastChannel.instances) {
      if (other !== this && !other.closed && other.name === this.name) {
        other.deliver(data);
      }
    }
  }

  addEventListener(_type: string, listener: MessageListener): void {
    this.listeners.add(listener);
  }

  removeEventListener(_type: string, listener: MessageListener): void {
    this.listeners.delete(listener);
  }

  close(): void {
    this.closed = true;
  }

  private deliver(data: unknown): void {
    for (const listener of this.listeners) {
      listener(new MessageEvent('message', { data }));
    }
  }
}

describe('cross-tab sign-out', (): void => {
  beforeEach((): void => {
    FakeBroadcastChannel.instances = [];
    vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel);
  });

  afterEach((): void => {
    vi.unstubAllGlobals();
  });

  it('notifies a subscribed tab when another tab broadcasts a sign-out', (): void => {
    const onSignOut = vi.fn();
    subscribeToSignOut(onSignOut);

    broadcastSignOut();

    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it('ignores unrelated messages on the channel', (): void => {
    const onSignOut = vi.fn();
    subscribeToSignOut(onSignOut);

    new FakeBroadcastChannel(AUTH_BROADCAST_CHANNEL).postMessage('something-else');

    expect(onSignOut).not.toHaveBeenCalled();
  });

  it('delivers the sign-out message posted by a different tab', (): void => {
    const onSignOut = vi.fn();
    subscribeToSignOut(onSignOut);

    new FakeBroadcastChannel(AUTH_BROADCAST_CHANNEL).postMessage(AUTH_SIGNED_OUT_MESSAGE);

    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it('stops notifying after unsubscribe', (): void => {
    const onSignOut = vi.fn();
    const unsubscribe = subscribeToSignOut(onSignOut);

    unsubscribe();
    broadcastSignOut();

    expect(onSignOut).not.toHaveBeenCalled();
  });

  it('does not throw where BroadcastChannel is unavailable', (): void => {
    vi.stubGlobal('BroadcastChannel', undefined);

    const unsubscribe = subscribeToSignOut(vi.fn());

    expect(() => broadcastSignOut()).not.toThrow();
    expect(() => unsubscribe()).not.toThrow();
  });
});
