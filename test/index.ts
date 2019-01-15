import { expect } from 'chai';
import Cache, { Context, Handler } from '../src';

const sleep = (t: number) => new Promise((rs: () => void) => setTimeout(rs, t));

// simple handler
class SimpleHandler implements Handler<number> {
  get source() {
    return 'SIMPLE';
  }
  private mp: Map<string, number>;
  constructor(mp: Map<string, number> = new Map()) {
    this.mp = mp;
  }
  private _set = (key: string, value: number) => {
    this.mp.set(key, value);
  };
  public get = async (ctx: Context<number>, next?: () => Promise<void>): Promise<void> => {
    ctx.body = this.mp.get(ctx.key);
    // return if got value
    if (ctx.body) {
      ctx.source = this.source;
      return;
    }
    await next();
    // cache to mp if got value from other middleware
    if (ctx.body) {
      await this._set(ctx.key, ctx.body);
    }
    return;
  };
  public set = async (ctx: Context<number>, next?: () => Promise<void>): Promise<void> => {
    this._set(ctx.key, ctx.body);
    await next();
    return;
  };
  public del = async (ctx: Context<number>, next?: () => Promise<void>): Promise<void> => {
    this.mp.delete(ctx.key);
  };
}

// the handler we mostly use, the + 100 here is just used to identity the result.
class NormalHandler implements Handler<number> {
  private source: string;
  private mp: Map<string, number>;
  private offset: number;
  constructor(mp: Map<string, number> = new Map(), offset: number = 100, source = 'NORMAL') {
    this.mp = mp;
    this.offset = offset;
    this.source = source;
  }
  private _set = (key: string, value: number) => {
    this.mp.set(key, value + this.offset);
  };
  public get = async (ctx: Context<number>, next?: () => Promise<void>): Promise<void> => {
    ctx.body = this.mp.get(ctx.key);
    // return if got value
    if (ctx.body) {
      ctx.source = this.source;
      return;
    }
    await next();
    // cache to mp if got value from other middleware
    if (ctx.body) {
      await this._set(ctx.key, ctx.body);
    }
    return;
  };
  public set = async (ctx: Context<number>, next?: () => Promise<void>): Promise<void> => {
    this._set(ctx.key, ctx.body);
    await next();
    return;
  };
}

// handler which do not return when getting result
class RewriteHandler implements Handler<number> {
  get source() {
    return 'REWRITE';
  }
  private mp: Map<string, number>;
  private offset: number;
  constructor(mp: Map<string, number> = new Map(), offset: number = 1000) {
    this.mp = mp;
    this.offset = offset;
  }
  private _set = (key: string, value: number) => {
    this.mp.set(key, value + this.offset);
  };
  public get = async (ctx: Context<number>, next?: () => Promise<void>): Promise<void> => {
    ctx.body = this.mp.get(ctx.key);
    if (ctx.body) {
      ctx.source = this.source;
      return;
    }
    await next();
    // cache to mp if got value from other middleware
    if (ctx.body) {
      await this._set(ctx.key, ctx.body);
    }
    return;
  };
}

describe('Stack', () => {
  it('single middleware should work fine.', async () => {
    const cache = new Cache<number>();
    const handler = new SimpleHandler();
    cache.use(handler);

    // test
    await cache.set('hello', 200);
    const v = await cache.get('hello');
    expect(v).to.equal(200);
  });

  it('should get data from the first middleware.', async () => {
    const cache = new Cache<number>();
    const handler1 = new NormalHandler();
    const handler2 = new NormalHandler(new Map(), 200);

    // first
    cache.use(handler1);
    // second
    cache.use(handler2);

    // test
    await cache.set('hello', 200);
    const v = await cache.get('hello');
    expect(v).to.equal(300);
  });

  it('should get right source.', async () => {
    const cache = new Cache<number>();
    const handler1 = new NormalHandler(new Map(), 100, 'h1');
    const handler2 = new NormalHandler(new Map(), 200, 'h2');

    // first
    cache.use(handler1);
    // second
    cache.use(handler2);

    // test
    await cache.set('hello', 200);
    const ctx = { key: 'hello', source: undefined };
    await cache.getContext(ctx);
    expect(ctx.source).to.equal('h1');
  });

  it('later middleware should rewrite the first cached data.', async () => {
    const cache = new Cache<number>();
    const handler1 = new RewriteHandler();
    const handler2 = new NormalHandler(new Map(), 2000);

    // first
    cache.use(handler1);
    // second
    cache.use(handler2);

    // test get/set
    await cache.set('hello', 200);
    const v = await cache.get('hello');
    expect(v).to.equal(2200);
  });

  it('cached data should be cleared after calling del.', async () => {
    const cache = new Cache<number>();
    const handler = new SimpleHandler();

    // first
    cache.use(handler);

    // test get/set
    await cache.set('hello', 200);
    const v = await cache.get('hello');
    expect(v).to.equal(200);
    await cache.del('hello');
    const vv = await cache.get('hello');
    expect(vv).to.equal(undefined);
  });
});
