// ============================================================
// ENTORNO DE PRUEBAS: se carga antes que la app.
// Las pruebas vacían todas las tablas, así que solo corren contra una BD *_test.
// ============================================================
export const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST
  || 'postgresql://test:test@localhost:5446/restaurante_test';

export function prepararEntorno() {
  const nombreBD = new URL(DATABASE_URL_TEST).pathname.slice(1);
  if (!nombreBD.endsWith('_test')) {
    throw new Error(`Las pruebas solo corren contra una BD terminada en _test (DATABASE_URL_TEST apunta a "${nombreBD}").`);
  }
  process.env.DATABASE_URL = DATABASE_URL_TEST;
  process.env.NODE_ENV = 'test';
  process.env.IGV_RATE = '0.105';
}
