import { useSyncExternalStore } from "react";

let frozen = false;
const listeners = new Set<() => void>();

const notifyListeners = () => {
  listeners.forEach((listener) => listener());
};

export const isFrontEndFrozen = () => frozen;

export const setFrontEndFrozen = (value: boolean) => {
  if (frozen === value) {
    return;
  }

  frozen = value;
  notifyListeners();
};

export const subscribeToFrontEndFreeze = (listener: () => void) => {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};

export const useFrontEndFrozen = () =>
  useSyncExternalStore(subscribeToFrontEndFreeze, isFrontEndFrozen, isFrontEndFrozen);
