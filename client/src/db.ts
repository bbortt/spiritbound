// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Copyright (c) 2026 Timon Borter. See LICENSE at the repository root.

import {
  DbConnection,
  type ErrorContext,
  type EventContext,
  type SubscriptionHandle,
} from './generated/index';
export type { DbConnection, ErrorContext, EventContext, SubscriptionHandle };

export * from './generated/types';

const DB_URI = 'ws://localhost:3000';
const DB_NAME = 'spiritbound';

export type TokenStore = {
  get(): string | undefined;
  set(token: string): void;
  clear(): void;
};

export function connect(
  tokenStore?: TokenStore,
  onSubscribed?: (conn: DbConnection) => void,
): DbConnection {
  return DbConnection.builder()
    .withUri(DB_URI)
    .withDatabaseName(DB_NAME)
    .withToken(tokenStore?.get())
    .onConnect((conn, identity, token) => {
      console.log('[spacetime] connected:', identity.toHexString());
      tokenStore?.set(token);
      _subscribeSlice(conn, onSubscribed);
    })
    .onConnectError((_ctx, err) => {
      console.error('[spacetime] connect error:', err);
      if (String(err).includes('Unauthorized') && tokenStore?.get()) {
        console.warn('[spacetime] stale token — clearing and reloading');
        tokenStore.clear();
        window.location.reload();
      }
    })
    .onDisconnect((_ctx, err) => {
      if (err) console.error('[spacetime] disconnected with error:', err);
      else console.log('[spacetime] disconnected');
    })
    .build();
}

function _subscribeSlice(
  conn: DbConnection,
  onSubscribed?: (conn: DbConnection) => void,
): SubscriptionHandle {
  // Card and item tables are in separate subscriptions so a failure there
  // doesn't break movement / combat.
  _subscribeCards(conn);
  _subscribeItems(conn);

  return conn
    .subscriptionBuilder()
    .onApplied(() => {
      console.log('[spacetime] subscription active');
      onSubscribed?.(conn);
    })
    .onError((ctx) => {
      const err = (ctx as any).event;
      console.error(
        '[spacetime] core subscription error:',
        err?.message ?? err,
      );
    })
    .subscribe([
      'SELECT * FROM character',
      'SELECT * FROM personal_spirit',
      'SELECT * FROM account_progress',
      'SELECT * FROM zone',
      'SELECT * FROM enemy',
      'SELECT * FROM card_definition',
    ]);
}

function _subscribeCards(conn: DbConnection): void {
  conn
    .subscriptionBuilder()
    .onApplied(() => console.log('[spacetime] card subscription active'))
    .onError((ctx) => {
      const err = (ctx as any).event;
      console.error(
        '[spacetime] card subscription error:',
        err?.message ?? err,
      );
    })
    .subscribe([
      'SELECT * FROM card_drop',
      'SELECT * FROM card_instance',
      'SELECT * FROM equipped_card',
    ]);
}

function _subscribeItems(conn: DbConnection): void {
  conn
    .subscriptionBuilder()
    .onApplied(() => console.log('[spacetime] item subscription active'))
    .onError((ctx) => {
      const err = (ctx as any).event;
      console.error(
        '[spacetime] item subscription error:',
        err?.message ?? err,
      );
    })
    .subscribe([
      'SELECT * FROM item_definition',
      'SELECT * FROM item_drop',
      'SELECT * FROM item_instance',
      'SELECT * FROM equipped_item',
    ]);
}

export function callReducer(name: string, fn: () => void): void {
  try {
    fn();
  } catch (e) {
    console.error(`[spacetime:reducer:${name}]`, e);
  }
}
