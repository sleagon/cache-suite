import { expect } from 'chai';
import Cache, { Context, Handler } from '../src';

const sleep = (t: number) => new Promise((rs: () => void) => setTimeout(rs, t));

// simple handler
class SimpleHandler implements Handler<number> {
  private mp: Map<string, number>;
  constructor(mp: Map<string, number> = new Map()) {
    this.mp = mp;
  }
  private _set = (key: string, value: number) => {
    this.mp.set(key, value);
  }
  public get = async (ctx: Context<number>, next?: () => Promise<void>): Promise<void> => {
    ctx.body = this.mp.get(ctx.key);
    // return if got value
    if (ctx.body) {
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

// the handler we mostly use, the + 100 here is just used to identity the result.
class NormalHandler implements Handler<number> {
  private mp: Map<string, number>;
  private offset: number;
  constructor(mp: Map<string, number> = new Map(), offset: number = 100) {
    this.mp = mp;
    this.offset = offset;
  }
  private _set = (key: string, value: number) => {
    this.mp.set(key, value + this.offset);
  }
  public get = async (ctx: Context<number>, next?: () => Promise<void>): Promise<void> => {
    ctx.body = this.mp.get(ctx.key);
    // return if got value
    if (ctx.body) {
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
  private mp: Map<string, number>;
  private offset: number;
  constructor(mp: Map<string, number> = new Map(), offset: number = 1000) {
    this.mp = mp;
    this.offset = offset;
  }
  private _set = (key: string, value: number) => {
    this.mp.set(key, value + this.offset);
  }
  public get = async (ctx: Context<number>, next?: () => Promise<void>): Promise<void> => {
    ctx.body = this.mp.get(ctx.key);
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
    expect(v).to.equal(300); // first middleware cache 200 as 300
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
    expect(v).to.equal(2200); // first middleware cache 200 as 300
  });
});