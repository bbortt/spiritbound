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
};

export function connect(tokenStore?: TokenStore): DbConnection {
  return DbConnection.builder()
    .withUri(DB_URI)
    .withDatabaseName(DB_NAME)
    .withToken(tokenStore?.get())
    .onConnect((conn, identity, token) => {
      console.log('[spacetime] connected:', identity.toHexString());
      tokenStore?.set(token);
      _subscribeSlice(conn);
    })
    .onConnectError((_ctx, err) => {
      console.error('[spacetime] connect error:', err);
    })
    .onDisconnect((_ctx, err) => {
      if (err) console.error('[spacetime] disconnected with error:', err);
      else console.log('[spacetime] disconnected');
    })
    .build();
}

function _subscribeSlice(conn: DbConnection): SubscriptionHandle {
  return conn
    .subscriptionBuilder()
    .onApplied(() => console.log('[spacetime] subscription active'))
    .onError((ctx) => console.error('[spacetime] subscription error:', ctx))
    .subscribe([
      'SELECT * FROM character',
      'SELECT * FROM personal_spirit',
      'SELECT * FROM card_instance',
      'SELECT * FROM equipped_card',
      'SELECT * FROM zone',
    ]);
}

export function callReducer(name: string, fn: () => void): void {
  try {
    fn();
  } catch (e) {
    console.error(`[spacetime:reducer:${name}]`, e);
  }
}
