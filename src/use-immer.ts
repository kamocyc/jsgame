import { Draft, freeze, nothing, produce } from 'immer';
import { Dispatch, useCallback, useMemo, useReducer, useState } from 'preact/hooks';
import { DeepReadonly } from 'ts-essentials';

export type DraftFunction<S> = (draft: Draft<S>) => void;
export type Updater<S> = (arg: S | DraftFunction<S>) => void;
export type ImmerHook<S> = [S, Updater<S>];

export function useImmer<S>(initialValue: S | (() => S)) {
  const [val, updateValue] = useState(
    () => freeze(typeof initialValue === 'function' ? (initialValue as any)() : initialValue, true) as DeepReadonly<S>
  );
  return [
    val,
    useCallback((updater: S | ((draft: S) => void)) => {
      // @ts-ignore
      if (typeof updater === 'function') updateValue(produce(updater));
      // @ts-ignore
      else updateValue(freeze(updater, true));
    }, []),
  ] as const;
}

// Provides different overloads of `useImmerReducer` similar to `useReducer` from `@types/react`.

export type ImmerReducer<S, A> = (draftState: Draft<S>, action: A) => void | (S extends undefined ? typeof nothing : S);

/**
 * @deprecated Use `ImmerReducer` instead since there is already a `Reducer` type in `@types/react`.
 */
export type Reducer<S = any, A = any> = ImmerReducer<S, A>;

export function useImmerReducer<S, A, I>(
  reducer: ImmerReducer<S, A>,
  initializerArg: S & I,
  initializer: (arg: S & I) => S
): [S, Dispatch<A>];

export function useImmerReducer<S, A, I>(
  reducer: ImmerReducer<S, A>,
  initializerArg: I,
  initializer: (arg: I) => S
): [S, Dispatch<A>];

export function useImmerReducer<S, A>(
  reducer: ImmerReducer<S, A>,
  initialState: S,
  initializer?: undefined
): [S, Dispatch<A>];

export function useImmerReducer<S, A, I>(
  reducer: ImmerReducer<S, A>,
  initializerArg: S & I,
  initializer?: (arg: S & I) => S
) {
  const cachedReducer = useMemo(() => produce(reducer), [reducer]);
  // @ts-ignore
  return useReducer(cachedReducer, initializerArg as any, initializer as any);
}
