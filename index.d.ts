import type { Readable } from "svelte/store";

export type Stetson<T, Actions> = Readable<T> & Actions;

type Funcs = { [n: string]: (...args: unknown[]) => unknown };
type StetsonApi<T> = { value: T };
interface StetsonBuilder<T> {
  actions<Actions extends Funcs>(
    a: (s: StetsonApi<T>) => Actions,
  ): Stetson<T, Actions>;
}

export function stetson<T>(value: T): StetsonBuilder<T>;
