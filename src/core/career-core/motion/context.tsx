"use client";

import { createContext, useContext, useRef, type ReactNode } from "react";

import {
  createCareerCoreMotionStore,
  type CareerCoreMotionStore,
} from "./shared";

const CareerCoreMotionContext = createContext<CareerCoreMotionStore | null>(null);

export function CareerCoreMotionProvider({
  children,
  store,
}: {
  children: ReactNode;
  store: CareerCoreMotionStore;
}) {
  return (
    <CareerCoreMotionContext.Provider value={store}>
      {children}
    </CareerCoreMotionContext.Provider>
  );
}

export function useCareerCoreMotionStore() {
  return useContext(CareerCoreMotionContext);
}

export function useCareerCoreMotionStoreRef() {
  const storeRef = useRef<CareerCoreMotionStore>(createCareerCoreMotionStore());
  return storeRef;
}
