// Ayudas para armar el ticket impreso (se llaman al cobrar, no durante el render)

// Resumen (hash) de muestra que va impreso en el ticket mientras no hay facturación electrónica
export const hashResumenSimulado = () => `gSbTDa${Math.random().toString(36).substring(2, 8).toUpperCase()}iIZDyirfA6TBPKJnEI=`;
