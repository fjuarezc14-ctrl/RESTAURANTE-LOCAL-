import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { COMPANY_CONFIG as DEFAULT_CONFIG } from '../config/company';

const CompanyContext = createContext({
  empresa: DEFAULT_CONFIG,
  loading: false,
  reloadEmpresa: async () => {},
});

// Los tickets y reportes leen COMPANY_CONFIG de forma estática: se sincroniza con los datos
// guardados en Configuración para que impriman el nombre y RUC reales de la empresa
const syncStaticConfig = (config) => Object.assign(DEFAULT_CONFIG, config);

export const CompanyProvider = ({ children }) => {
  const [empresa, setEmpresa] = useState(() => {
    try {
      const stored = localStorage.getItem('cached_empresa_config');
      if (stored) {
        return syncStaticConfig({ ...DEFAULT_CONFIG, ...JSON.parse(stored) });
      }
    } catch (e) {
      // Usar defaults si falla el parseo
    }
    return DEFAULT_CONFIG;
  });

  const [loading, setLoading] = useState(false);

  const reloadEmpresa = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getEmpresa();
      if (data && !data.error) {
        const merged = {
          ...DEFAULT_CONFIG,
          ...data,
          ruc: data.ruc || DEFAULT_CONFIG.ruc,
          address: data.address || DEFAULT_CONFIG.address,
          phone: data.phone || DEFAULT_CONFIG.phone,
          name: data.name || DEFAULT_CONFIG.name,
          brandShort: data.brandShort || DEFAULT_CONFIG.brandShort,
          legalName: data.legalName || DEFAULT_CONFIG.legalName,
          ticketFooter: data.ticketFooter || DEFAULT_CONFIG.ticketFooter,
        };
        syncStaticConfig(merged);
        setEmpresa({ ...merged });
        document.title = `${merged.name} - Sistema POS`;
        localStorage.setItem('cached_empresa_config', JSON.stringify(merged));
      }
    } catch (err) {
      // Si falla la red, mantiene la configuración cacheada en localStorage
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reloadEmpresa();
  }, [reloadEmpresa]);

  return (
    <CompanyContext.Provider value={{ empresa, loading, reloadEmpresa }}>
      {children}
    </CompanyContext.Provider>
  );
};

export const useCompany = () => useContext(CompanyContext);
