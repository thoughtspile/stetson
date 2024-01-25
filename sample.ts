import { stetson } from ".";

const counter = stetson(0).actions((store) => ({
  up: () => store.value++,
  down: () => store.value--,
  reset: () => (store.value = 0),
}));

const _store = writable({
  data: null,
  loading: false,
  error: false,
});
const store = {
  subscribe: _store.subscribe,
  load: async () => {
    _store.update((s) => ({ ...s, loading: true }));
    try {
      const data = await api();
      _store.set({ ...data, loading: false, error: false });
    } catch (err) {
      _store.update((s) => ({ ...s, loading: false, error: true }));
    }
  },
};

const sstore = stetson({
  data: null,
  loading: false,
  error: false,
}).actions(({ value }) => ({
  async load() {
    value.loading = true;
    try {
      value.data = await api();
      value.error = false;
    } catch (err) {
      value.error = true;
    } finally {
      value.loading = false;
    }
  },
}));
