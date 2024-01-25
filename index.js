import { writable } from "svelte/store";

export const stetson = (value) => ({
  actions: (builder) => {
    const s = writable(value);

    let dirty;
    const flush = () => dirty && (dirty = s.set(value));
    const invalidate = async () => !dirty && ((dirty = s), await s, flush());

    let valueProxy =
      value instanceof Object
        ? new Proxy(value, {
            get: (_, p) => {
              invalidate();
              return value[p];
            },
            set: (_, p, v) => {
              invalidate();
              return (value[p] = v);
            },
          })
        : value;

    const boundActions = builder({
      get value() {
        return valueProxy;
      },
      set value(nextValue) {
        invalidate();
        value = nextValue;
        !(value instanceof Object) && (valueProxy = value);
      },
    });

    const res = { subscribe: s.subscribe };
    for (const k in boundActions) {
      res[k] = (...args) => {
        const res = boundActions[k](...args);
        flush();
        return res && res.finally ? res.finally(flush) : res;
      };
    }

    return res;
  },
});
