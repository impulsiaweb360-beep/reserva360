'use client';

import { createContext, useContext } from 'react';

// Datos públicos del negocio ya cargados en el servidor (mismos que devuelve get_public_tenant)
const InitialTenantContext = createContext(null);

export function InitialTenantProvider({ value, children }) {
  return <InitialTenantContext.Provider value={value}>{children}</InitialTenantContext.Provider>;
}

export const useInitialTenant = () => useContext(InitialTenantContext);
