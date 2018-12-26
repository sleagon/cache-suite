import * as assert from 'assert';
import * as compose from 'koa-compose';

// koa-like context
export declare interface Context<T> {
  key: string;
  body?: T;
  err?: Error;
}

// standard cache method set/get
export type Method = 'get' | 'set';

// HandlerFunc middlware for set/get
type HandlerFunc<T> = (ctx: Context<T>, next?: () => Promise<void>) => Promise<void>;

// Handler interface to handle set/get
export declare interface Handler<T> {
  get: HandlerFunc<T>;
  set?: HandlerFunc<T>;
}

// Cache core for cache
export default class Cache<T> {
  // raw handler list
  private handlers: Array<Handler<T>>;
  // composed handler map (key is set/get)
  private composedHandlerMap: Map<Method, HandlerFunc<T>>;
  constructor() {
    this.handlers = [];
    this.composedHandlerMap = new Map();
  }
  /**
   * add a new handler
   * @param handler Handler<T>
   * @returns this for chain operation
   */
  public use(handler: Handler<T>) {
    this.handlers.push(handler);
    // compose all handler together
    this.composedHandlerMap.set('get', compose(this.handlers.map((h) => h.get.bind(h))));
    // compose set handler in reversed order.
    // e.g. you could use memory/local/redis/oss as your cache list,
    // when you set some data to cache, you should set them in reversed order.
    // Actually, you could just set the last one(oss here) and when the data is
    // requested, cache it to other cacher then.
    this.composedHandlerMap.set(
      'set',
      compose(
        this.handlers
          .filter((h) => h && h.set)
          .map((h) => h.set.bind(h))
          .reverse(),
      ),
    );
    return this;
  }
  /**
   * get data in context way when you need to control the data flow.
   * @param ctx Context<T> koa-like context
   * @returns Context<T>   modified context
   */
  public async getContext(ctx: Context<T>): Promise<Context<T>> {
    assert(ctx, 'null context is not valid.');
    assert(ctx.key, 'context#key is necessary.');
    assert(this.handlers.length, 'forgot to call .use?');
    const handler = this.composedHandlerMap.get('get');
    if (!handler) {
      return ctx;
    }
    await handler(ctx);
    return ctx;
  }
  /**
   * get your data in a simple way
   * @param key string   cached key
   * @returns Promise<T> just the payload you need
   */
  public async get(key: string): Promise<T> {
    const { body } = await this.getContext({ key });
    return body;
  }
  /**
   * just like getContext
   * @param ctx Context<T> koa-like context
   * @returns Context<T>   modified context
   */
  public async setContext(ctx: Context<T>): Promise<Context<T>> {
    assert(ctx, 'null context is not valid.');
    assert(ctx.key, 'context#key is necessary.');
    assert(this.handlers.length, 'forgot to call .use?');
    const handler = this.composedHandlerMap.get('set');
    if (!handler) {
      return ctx;
    }
    await handler(ctx);
    return ctx;
  }
  /**
   * set your data in a simple way
   * @param key string   cached key
   * @param value T      data to cache
   * @returns Promise<T> just the payload you need
   */
  public async set(key: string, value: T): Promise<Error> {
    const { err } = await this.setContext({ key, body: value });
    return err;
  }
}
