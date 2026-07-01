import { createContext, ReactNode, useContext } from "react";
import { RootStore } from "./rootStore";

const StoreContext = createContext<RootStore | null>(null);

type StoreProviderProps = {
  children: ReactNode;
  store: RootStore;
};

export function StoreProvider({ children, store }: StoreProviderProps) {
  console.log("[StoreProvider]");
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore(): RootStore {
  console.log("[useStore]");
  const store = useContext(StoreContext);
  if (!store) {
    throw new Error("useStore must be used within StoreProvider.");
  }

  return store;
}
