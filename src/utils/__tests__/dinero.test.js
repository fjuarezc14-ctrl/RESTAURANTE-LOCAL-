import { describe, it, expect } from 'vitest';
import {
  redondear,
  formatearMoneda,
  desglosarIGV,
  calcularVuelto,
  aplicarDescuento,
  validarCuadrePagos,
  calcularTotalItems,
} from '../dinero';

describe('Utilidades de Dinero y Contabilidad (dinero.js)', () => {
  describe('redondear()', () => {
    it('redondea correctamente centavos evitando problemas de punto flotante', () => {
      expect(redondear(0.1 + 0.2)).toBe(0.3);
      expect(redondear(10.555)).toBe(10.56);
      expect(redondear(10.554)).toBe(10.55);
    });

    it('devuelve 0 ante entradas no numéricas o infinitas', () => {
      expect(redondear(NaN)).toBe(0);
      expect(redondear(undefined)).toBe(0);
      expect(redondear(Infinity)).toBe(0);
    });
  });

  describe('formatearMoneda()', () => {
    it('formatea montos con símbolo de Soles S/ y dos decimales', () => {
      expect(formatearMoneda(15)).toBe('S/ 15.00');
      expect(formatearMoneda(1250.5)).toMatch(/1.*250\.50/);
    });

    it('permite omitir el símbolo si se especifica', () => {
      expect(formatearMoneda(24.9, false)).toBe('24.90');
    });
  });

  describe('desglosarIGV()', () => {
    it('desglosa correctamente el IGV (18%) a partir del total con impuesto incluido', () => {
      const res = desglosarIGV(118);
      expect(res.subtotal).toBe(100);
      expect(res.igv).toBe(18);
      expect(res.total).toBe(118);
    });

    it('mantiene la suma de subtotal + igv coherente ante centavos impares', () => {
      const res = desglosarIGV(35.5);
      expect(res.subtotal + res.igv).toBeCloseTo(35.5, 2);
    });

    it('soporta tasas alternativas', () => {
      const res = desglosarIGV(110, 0.1);
      expect(res.subtotal).toBe(100);
      expect(res.igv).toBe(10);
    });
  });

  describe('calcularVuelto()', () => {
    it('calcula el vuelto cuando el efectivo entregado supera el total', () => {
      expect(calcularVuelto(35.5, 50)).toBe(14.5);
      expect(calcularVuelto(100, 100)).toBe(0);
    });

    it('devuelve 0 si el efectivo entregado es menor al total', () => {
      expect(calcularVuelto(50, 40)).toBe(0);
    });
  });

  describe('aplicarDescuento()', () => {
    it('aplica descuento por porcentaje correctamente', () => {
      const res = aplicarDescuento(200, 'porcentaje', 10);
      expect(res.totalOriginal).toBe(200);
      expect(res.descuento).toBe(20);
      expect(res.totalFinal).toBe(180);
    });

    it('no permite descuentos por porcentaje superiores al 100%', () => {
      const res = aplicarDescuento(100, 'porcentaje', 150);
      expect(res.descuento).toBe(100);
      expect(res.totalFinal).toBe(0);
    });

    it('aplica descuento por monto fijo correctamente', () => {
      const res = aplicarDescuento(85, 'monto', 15);
      expect(res.totalOriginal).toBe(85);
      expect(res.descuento).toBe(15);
      expect(res.totalFinal).toBe(70);
    });

    it('no permite que el descuento supere el monto total', () => {
      const res = aplicarDescuento(50, 'monto', 90);
      expect(res.descuento).toBe(50);
      expect(res.totalFinal).toBe(0);
    });
  });

  describe('validarCuadrePagos()', () => {
    it('valida como cuadrado un pago único exacto', () => {
      const res = validarCuadrePagos(50, { efectivo: 50 });
      expect(res.cuadra).toBe(true);
      expect(res.diferencia).toBe(0);
      expect(res.faltante).toBe(0);
      expect(res.sobrante).toBe(0);
    });

    it('valida como cuadrado un pago mixto exacto', () => {
      const res = validarCuadrePagos(120, {
        efectivo: 50,
        tarjeta: 30,
        yape: 40,
      });
      expect(res.cuadra).toBe(true);
      expect(res.suma).toBe(120);
    });

    it('identifica monto faltante', () => {
      const res = validarCuadrePagos(100, { efectivo: 80 });
      expect(res.cuadra).toBe(false);
      expect(res.faltante).toBe(20);
      expect(res.sobrante).toBe(0);
    });

    it('identifica monto sobrante', () => {
      const res = validarCuadrePagos(100, { efectivo: 120 });
      expect(res.cuadra).toBe(false);
      expect(res.faltante).toBe(0);
      expect(res.sobrante).toBe(20);
    });

    it('absorbe tolerancia de 1 céntimo por redondeo', () => {
      const res = validarCuadrePagos(33.33, { efectivo: 33.34 });
      expect(res.cuadra).toBe(true);
    });
  });

  describe('calcularTotalItems()', () => {
    it('suma productos normales según cantidad y precio', () => {
      const items = [
        { nombre: 'Lomo Saltado', precio: 30, cantidad: 2 },
        { nombre: 'Inca Kola 500ml', precio: 5, cantidad: 3 },
      ];
      expect(calcularTotalItems(items)).toBe(75);
    });

    it('excluye componentes de combo (esComponente: true) ya cobrados en el combo', () => {
      const items = [
        { nombre: 'Combo Familiar', precio: 80, cantidad: 1 },
        { nombre: 'Papas Fritas Familiar', precio: 0, cantidad: 1, esComponente: true },
        { nombre: 'Gaseosa 1.5L', precio: 0, cantidad: 1, esComponente: true },
      ];
      expect(calcularTotalItems(items)).toBe(80);
    });
  });
});
