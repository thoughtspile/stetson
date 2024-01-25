import { writable } from "svelte/store";

export const stetson = (value) => ({
  actions: (builder) => {
    const s = writable(value);

    let dirty;
    const flush = () => dirty && (dirty = s.set(value));
    const invalidate = async () => !dirty && ((dirty = s), await s, flush());

    let valueProxy;
    const makeStateProxy = () => {
      valueProxy =
        value instanceof Object
          ? new Proxy(value, {
              get: (_, p) => {
                invalidate();
                return target[p];
              },
              set: (_, p, v) => {
                invalidate();
                return (target[p] = v);
              },
            })
          : value;
    };
    makeStateProxy();

    const boundActions = builder({
      get value() {
        return value;
      },
      set value(nextValue) {
        invalidate();
        value = nextValue;
        makeStateProxy();
      },
    });

    const res = { subscribe: s.subscribe };
    for (const k in boundActions) {
      res[k] = (...args) => {
        const res = boundActions[k](...args);
        flush();
        return res;
      };
    }

    return res;
  },
});
