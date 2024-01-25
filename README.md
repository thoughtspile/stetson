# Stetson — the no-fuss svelte store

Stetson is a thin wrapper over svelte stores that makes your life easier. **Stability: experimental, feedback welcome.**

- **Embrace mutable state.** Svelte is good at mutable state. No need for immutable mumbo-jumbo.
- **Safe data access.** All the actions on your data are described in one place. No surprises.
- **Non-opinionated.** Use built-in or custom classes for state. Use sync, promise, async / await or callback actions. Actions can return what you want. I don't care.
- **Simple and tiny.** No new concepts to learn. Under 300 bytes in your bundle.
- **Auto-batching.** Multiple synchronous updates trigger subscribers once. Good for performance.

[Try it out now](https://svelte.dev/repl/b012c6f51ca64159b3a30bba1b0a1af6?version=4.2.9) or install:

```sh
npm install stetson
```

## Examples

The obligatory counter. Yes, stetson can store primitives:

```ts
const counter = stetson(0).actions((s) => ({
  up: () => s.value++,
  reset: () => (s.value = 0),
}));
```

Object state? No problem, just mutate it. Todo app:

```ts
type Todo = { text: string; done: boolean; id: string };
const todos = stetson<Todo[]>([]).actions((store) => ({
  add(text: Good) {
    store.value.push({ text, done: false, id: `${Math.random()}` });
  },
  remove(id: string) {
    store.value = store.value.filter((g) => g.id !== id);
  },
  toggle(id: string) {
    const item = store.value.find((g) => g.id === id);
    if (item) {
      item.done = !item.done;
    }
  },
}));
```

Async actions? You got it:

```ts
const data = stetson({
  data: null,
  loading: false,
  error: false,
}).actions({ value } => ({
  async load() {
    value.loading = true
    try {
      value.data = await api()
      value.error = false
    } catch (err) {
      value.error = true
    } finally {
      value.loading = false
    }
  }
}))
```

## Pain points solved

**Custom stores are harder than needed.** Yes, you can have a custom store in raw svelte, but you must move it to a separate JS / TS file _or_ wrap in a function to remove the underlying writable from scope, and it's not very ergonomic with all the set / update calls. [Official example:](https://svelte.dev/examples/custom-stores)

```js
function createCount() {
  const { subscribe, set, update } = writable(0);

  return {
    subscribe,
    increment: () => update((n) => n + 1),
    decrement: () => update((n) => n - 1),
    reset: () => set(0),
  };
}
const counter = createCount();
```

Much easier with stetson:

```js
const counter = stetson(0).actions((store) => {
  increment: () => store.value++,
  decrement: () => store.value--,
  reset: () => store.value = 0
});
```

**Method calls don't trigger update.** Svelte only sees a store change if you call `set()` or `update()`, or assign `$store = value` in a `.svelte` file. We work around it with awkward stuff like...

```js
$store.push("item");
$store = $store;
// or, in JS:
store.set($store);
store.update((v) => v);
```

No problem for stetson, every state access (push, add, property mutation) schedules an update.

```js
const store = stetson([]).actions(({ value }) => {
  push: (el) => value.push(el);
});
store.push("item");
```

**Reading current value is hard.** If you need the current store state in an action, you read it via `get(store)` (extra import + some runtime cost), or from `s.update(v => ...)` argument. Since it's some work, you can easily save a stale value:

```ts
const search = writable({ q: "", items: [] });
async function onChange(query: string) {
  // we destructure to avoid calling get repeatedly
  const { q } = get(search);
  search.update((s) => ({ ...s, q: query }));
  const items = await searchApi(query);
  // suppose another onChange is called after we start awaiting
  // we try to avoid the race by comparing query:
  if (q === query) {
    // and we fail, because query was saved before it was changed
    search.update((s) => ({ ...s, items }));
  }
}
```

In stetson, it's super easy to access to the current value:

```ts
const search = stetson({ q: "", items: [] }).actions(({ value }) => ({
  async load(q: string) {
    value.q = q;
    const items = await searchApi(q);
    if (value.q === q) {
      value.items = items;
    }
  },
}));
```

**Easy to trigger multiple updates.** Every `set() / update()` synchronously calls all subscribers — not a _huge_ issue, but to avoid this you must tediously group updates:

```js
store.update((s) => ({ ...s, loading: true }));
try {
  // ...
  store.set({ loading: false, error: false, ...res });
} catch {
  // ...
  store.set({ loading: false, error: true });
}
```

Stetson auto-batching removes this burden - any synchronous updates are grouped into one `set()` call.

## Cookbook

Stetson is minimal yet very flexible. Here are some more advanced scenarios.

**Async actions** work with async functions, raw promises, or callbacks. State updates are always synchronously flushed after the initial action call and when the promise eturned from the action resolves or rejects. Updates in the middle of promise chain, or in an async callback, schedule a flush microtask.

```js
const time = stetson(0).actions((s) => ({
  start: () => {
    s.value = Date.now();
    setInterval(() => {
      s.value += 1000;
      // flush
    }, 1000);
    // flush Date.now()
  },
  wait: async () => {
    s.value = 0;
    // sync flush
    await loadValue();
    s.value = 1;
    // flush by async set
    await loadValue();
    s.value = 2;
    // flush by resolve
  },
}));
```

**Reassigning state** instead of setting its properties is done by assigning to `value` property of the parameter:

```js
// for primitive values:
const num = stetson(0).actions((s) => {
  next: () => (s.value = s.value + 1);
});
// or for objects:
const num = stetson({}).actions((s) => {
  set: (data) => (s.value = data);
});
```

**Return values** of actions can be whatever you want, it's not used for state updates or anything (unlike reducers).

```js
const todos = stetson([]).actions(s => {
  // resulting length? ok:
  add: (el) => s.value.push(el),
  // full state? good:
  add2(el) {
    s.value.push(el)
    return s;
  },
  // noting? fine:
  add3(el) {
    s.value.push(el);
  },
  // someting unrelated? whatever
  add4(el) {
    s.value.push(el);
    return 'lol';
  }
});
```

**Compound and private actions** are built by declaring functions in the builder closure. Updates are only flushed after the outer (exposed to the user) action finishes.

```js
const list = stetson([]).actions((store) => {
  function add(el) {
    store.value.push(el);
  }
  // private action
  function remove(el) {
    store.value = store.value.filter((x) => x === el);
  }
  // compound action using add and remove base actions
  function toggle(el) {
    store.value.includes(el) ? remove(el) : add(el);
  }
  // expose add & toggle
  return { add, toggle };
});
```

**Non-reactive state** can also be stored as closure variable. The builder is guaranteed to be called only once:

```js
const ticker = stetson(0).actions((store) => {
  // this value is shared between all actions, but is not reactive or visible from outside.
  let interval;
  return {
    start() {
      interval = setInterval(() => store.value++, 1000);
    },
    stop() {
      clearInterval(interval);
    },
  };
});
```

## Caveats

I've done my best to avoid common footguns, but there are some limitations. Know how to fix these? Let me know in the issues!

```js
// 1. Assigning destructured value
stetson(false).actions(({ value }) => ({
  // sure enough, this just reassigns a local variable
  toggle: () => value = !value
}))
// instead, assign to store property:
stetson(false).actions((store) => ({
  toggle: () => store.value = !store.value
}))


// 2. Destructuring object value in async actions
stetson({ messages: [] }).actions(({ value }) => ({
  add: () => {
    // Changes are triggered
    // 1. by reading "value"
    // 2. by accessing any property of (object) value
    // 3. after action call
    // 4. after promise action settles
    const { messages } = value
    // If you detach a property of value
    // and change it asynchronously, bad luck:
    setTimeout(() => messages.push({}), 1000)

    // fix: always pass the whole value around
    setTimeout(() => value.messages.push({}), 1000)
  }
}))


// 3. Every value access schedules an update
stetson([1]).actions(({ value }) => ({
  add: (id) => {
    // no changes happen in this action
    if (value.includes(id)) return
    // still, subscribers are called
    // because we don't know if that includes does not mutate
    // hope it's not a deal breaker.
  }
}))


// 4. Uncaught exceptions lead to partial updates.
// say we want success = !!data
stetson({ success: false: data: null }).actions(({ value }) => ({
  // Stetson actually
  setData(data) {
    value.success = true
    // next line throws:
    if (value.data.id !== data.id) {
      value.data = data
    }
    // now we have { success: true, data: null }
  }
  // To avoid:
  // a. Use derived state
  // b. Move all updates _after_ unsafe operations
  // c. Add try / catch with manual rollback
}))


// 5. Reading self or derived stores inside actions.
const counter = stetson(0).actions((s) => {
  up: () => {
    s.value++
    // on first call...
    get(store) // returns 0
    get(hasValue) // returns false
    // because updates are not flushed yet
    // fix: just use s.value
  }
})
const hasValue = derived(counter, c => c > 0)
```

## Acknowledgements

Thanks to [immer](https://immerjs.github.io/immer/) for making mutable hip again. Their job bridging mutable interface with react's immutable data model is top notch, good thing svelte supports mutable data by default.

Action builders are greatly influenced by [MobX-state-tree](https://mobx-state-tree.js.org/intro/welcome) and [zustand](https://github.com/pmndrs/zustand).

## License

[MIT License](./LICENSE)
