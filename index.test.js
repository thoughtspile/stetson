import { mock, test } from "node:test";
import assert from "node:assert/strict";
import { stetson } from "./index.js";

test("Readable", async () => {
  await test("is readable", () => {
    const store = stetson(0).actions(() => ({}));
    let res;
    store.subscribe((v) => (res = v));
    assert.equal(res, 0);
  });
  await test("no extra methods", () => {
    const store = stetson(0).actions(() => ({}));
    assert.deepEqual(Object.keys(store), ["subscribe"]);
  });
});

test("sync actions", async () => {
  await test("return value is preserved", () => {
    const store = stetson(0).actions((store) => ({
      next() {
        store.value++;
        return "hello";
      },
    }));
    assert.deepEqual(store.next(), "hello");
  });
  await test("arguments are passed", () => {
    const store = stetson(0).actions(() => ({
      next: (...args) => args,
    }));
    assert.deepEqual(store.next(1, 2, 3), [1, 2, 3]);
  });
  await test("updates are batched", () => {
    const cb = mock.fn();
    const store = stetson(0).actions((store) => ({
      next: () => {
        store.value++;
        store.value++;
        store.value++;
        store.value++;
        store.value++;
      },
    }));
    store.subscribe(cb);
    cb.mock.resetCalls();
    store.next();
    assert.deepEqual(cb.mock.callCount(), 1);
  });
  await test("mutation triggers update", () => {
    const store = stetson({ count: 0 }).actions(({ value }) => ({
      next: () => value.count++,
    }));
    let res;
    store.subscribe((v) => (res = { ...v }));
    store.next();
    assert.deepEqual(res, { count: 1 });
  });
  await test("primitive assignment triggers update", () => {
    const store = stetson(0).actions((store) => ({
      next: () => store.value++,
    }));
    let res;
    store.subscribe((v) => (res = v));
    store.next();
    assert.deepEqual(res, 1);
  });
  await test("object assignment triggers update", () => {
    const store = stetson({ count: 0 }).actions((store) => ({
      next: () => (store.value = { count: store.value.count + 1 }),
    }));
    let res;
    store.subscribe((v) => (res = { ...v }));
    store.next();
    assert.deepEqual(res, { count: 1 });
  });
  await test("method call triggers update", () => {
    const store = stetson([]).actions(({ value }) => ({
      add: (el) => value.push(el),
    }));
    let res;
    store.subscribe((v) => (res = [...v]));
    store.add(100);
    assert.deepEqual(res, [100]);
  });
  await test("object assignment preserves proxy", () => {
    const store = stetson({ count: 0 }).actions((store) => ({
      replace: () => (store.value = { count: store.value.count + 1 }),
      add: () => store.value.count++,
    }));
    let res;
    store.subscribe((v) => (res = { ...v }));
    store.replace();
    store.add();
    assert.deepEqual(res, { count: 2 });
  });
});

test("async actions", async () => {
  await test("sync update is flushed", () => {
    const store = stetson(0).actions((store) => ({
      async next() {
        store.value++;
        await Promise.resolve();
        store.value++;
      },
    }));
    let res;
    store.subscribe((v) => (res = v));
    store.next();
    assert.deepEqual(res, 1);
  });
  await test("final update is flushed before action resolve", async () => {
    const store = stetson(0).actions((store) => ({
      async next() {
        store.value++;
        await Promise.resolve();
        store.value++;
      },
    }));
    let res;
    store.subscribe((v) => (res = v));
    await store.next();
    assert.deepEqual(res, 2);
  });
  await test("intermediate updates are flushed in promise", async () => {
    const cb = mock.fn();
    const store = stetson(0).actions((store) => ({
      async next() {
        store.value++;
        await Promise.resolve();
        store.value++;
        await Promise.resolve();
        store.value++;
      },
    }));
    store.subscribe(cb);
    cb.mock.resetCalls();
    await store.next();
    assert.deepEqual(cb.mock.callCount(), 3);
  });
  await test("callback updates are flushed", async () => {
    const cb = mock.fn();
    const store = stetson(0).actions((store) => ({
      getHandle: () => () => store.value++,
    }));
    store.subscribe(cb);
    cb.mock.resetCalls();
    const hd = store.getHandle();
    hd();
    await Promise.resolve();
    assert.deepEqual(cb.mock.callCount(), 1);
  });
});
