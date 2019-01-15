# Cache Suite

[![Build Status](https://travis-ci.org/sleagon/cache-suite.svg?branch=master)](https://travis-ci.org/sleagon/cache-suite)

## Features

In order to keep our system as strong as possible, we may build multi level cache in production environment, such as memory/file system/redis/oss... This package is written
to manage this kind of problem. Just add your cacher middleware to the cache chain like
koa middleware, then use cache.get/set simply. 😁😁😁

- Fully typescript supported.
- Koa-like cache handler.
- Multi level cacher supported.
- Simple, Reliable, Flexible.

## Usage

Take a look the test cases if you want to know how to use it in typescript project.

### Install

```bash
npm install cache-suite --save
# or
yarn add cache-suite
```

### Basic Cache

You can init a empty cache using ```new Cache()```.

### Middleware(caches)

Just like koa, you can add mddleware cache using ```cache.use(...)```. Function use need a interface having get property.

```js
export declare interface Handler<T> {
    get: HandlerFunc<T>;
    set?: HandlerFunc<T>;
    del?: HandlerFunc<T>;
}
Cache#use(handler: Handler<T>): this;
```

### Set/Get

Just ```cache.get(...)``` or ```cache.set(...)```.


### Simplest case

```js
const Cache = require('../lib/index.js').default;
const mp = new Map();
const memoryCache = {
  get: async ctx => ctx.body = mp.get(ctx.key),
  set: async ctx => mp.set(ctx.key, ctx.body),
  del: async ctx => mp.delete(ctx.key),
}

const cache = new Cache();
cache.use(memoryCache);

(async function call() {
  await cache.set('foo', 'bar');
  let data = await cache.get('foo');
  console.log('>>>', data);
  // >>> bar
  await cache.del('foo');
  data = await cache.get('foo');
  console.log('>>>', data);
  // >>> undefined
})()
```

### Chained case

```js
const Cache = require('../lib/index.js').default;
const { promisify } = require('util');
const fs = require('fs');

// simple memory cache
class MemoryCache {
  constructor() {
    this.mp = new Map();
  }
  async get(ctx, next) {
    ctx.body = this.mp.get(ctx.key);
    if (ctx.body) {
      ctx.body = '[from MemoryCache]' + ctx.body;
      ctx.source = 'MEMORY';
      return;
    }
    await next();
    if (ctx.body) {
      this.mp.set(ctx.key, ctx.body);
    }
  }
}

// simple file system cache
class FileCache {
  constructor() {
    // make sure /tmp/test exist
    this.baseDir = '/tmp/test';
  }
  async get(ctx, next) {
    ctx.body = await promisify(fs.readFile)(`${this.baseDir}/${ctx.key}`);
    // add some useless info to show the source of data.
    ctx.body = '[from FileCache]' + ctx.body.toString();
    ctx.source = 'FILE';
  }
  async set(ctx, next) {
    await promisify(fs.writeFile)(`${this.baseDir}/${ctx.key}`, ctx.body);
  }
}

const cache = new Cache();
const mcache = new MemoryCache();
const fcache = new FileCache();
cache.use(mcache);
cache.use(fcache);

(async function call() {
  await cache.set('foo', 'bar');
  let data = await cache.get('foo');
  console.log('>>>', data);
  // >>> [from FileCache]bar
  data = await cache.get('foo');
  console.log('>>>', data);
  // memory cached data is from file cache, so [from FileCache] is cached as raw data.
  // >>> [from Memory][from FileCache]bar
})();

```
