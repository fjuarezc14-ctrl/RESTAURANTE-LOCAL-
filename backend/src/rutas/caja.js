// Rutas de caja: apertura, movimientos, arqueo en vivo y cierre
const express = require('express');
const { prisma } = require('../db');
const { resumenDelTurno, redondear } = require('../servicios/caja');
const { ErrorApp } = require('../middlewares/errores');
const { usuarioPorPinAutorizado } = require('../servicios/autorizacion');
const { validar, validarIdsEnUrl } = require('../middlewares/validar');
const { aperturaCaja, cierreCaja, cierreForzado, consultaCierres, consultaMovimientos, movimientoCaja } = require('../../shared/esquemas/caja.js');
const { requierePermiso } = require('../middlewares/permisos');
const { registrarAuditoria } = require('../servicios/auditoria');
const { idempotente } = require('../middlewares/idempotencia');

const router = express.Router();
validarIdsEnUrl(router);

// ============================================================
// CIERRES DE CAJA Y ARQUEOS PERSISTENTES (PostgreSQL)
// ============================================================

// GET /api/caja/estado → Estado en vivo de la caja (ABIERTO / CERRADO) y supervisión en tiempo real
router.get('/api/caja/estado', requierePermiso('Caja', 'Dashboard'), async (req, res, next) => {
  try {
    const turnoAbierto = await prisma.cierreCaja.findFirst({
      where: { estado: 'ABIERTO' },
      orderBy: { fechaApertura: 'desc' },
    });

    const ultimoCerrado = await prisma.cierreCaja.findFirst({
      where: { estado: 'CERRADO' },
      orderBy: { fechaCierre: 'desc' },
    });

    if (!turnoAbierto) {
      return res.json({
        ok: true,
        abierto: false,
        turno: null,
        ultimoCierre: ultimoCerrado,
      });
    }

    const resumen = await resumenDelTurno(turnoAbierto);

    res.json({
      ok: true,
      abierto: true,
      turno: turnoAbierto,
      ultimoCierre: ultimoCerrado,
      resumenEnVivo: resumen,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/caja/movimientos → Registrar salida (retiro de emergencia) o ingreso extra en la gaveta
router.post('/api/caja/movimientos', requierePermiso('Caja'), idempotente, validar({ body: movimientoCaja }), async (req, res, next) => {
  try {
    const { monto, motivo, tipo = 'RETIRO', cajeroNombre } = req.body;
    const parsedMonto = parseFloat(monto || 0);
    if (isNaN(parsedMonto) || parsedMonto <= 0) {
      return next(new ErrorApp('VALIDACION', 'El monto debe ser un número válido mayor a 0.', { campo: 'monto' }));
    }
    if (!motivo || !String(motivo).trim()) {
      return next(new ErrorApp('VALIDACION', 'Debe especificar el motivo del retiro o salida de caja.', { campo: 'motivo' }));
    }

    const turnoAbierto = await prisma.cierreCaja.findFirst({
      where: { estado: 'ABIERTO' },
      orderBy: { fechaApertura: 'desc' },
    });
    if (!turnoAbierto) {
      return next(new ErrorApp('CAJA_CERRADA', 'No se pueden registrar salidas de dinero con la caja cerrada.'));
    }

    const mov = await prisma.$transaction(async (tx) => {
      const creado = await tx.movimientoCaja.create({
        data: {
          turnoId: turnoAbierto.id,
          tipo: tipo === 'INGRESO' ? 'INGRESO' : 'RETIRO',
          monto: parsedMonto,
          motivo: String(motivo).trim(),
          cajeroNombre: cajeroNombre ? String(cajeroNombre).trim() : turnoAbierto.cajeroNombre,
        },
      });
      await registrarAuditoria(tx, req, {
        accion: 'CAJA_MOVIMIENTO', entidad: 'MovimientoCaja', entidadId: creado.id, nombreDeclarado: creado.cajeroNombre,
        despues: { turnoId: creado.turnoId, tipo: creado.tipo, monto: creado.monto }, motivo: creado.motivo,
      });
      return creado;
    });

    console.log(`💸 Movimiento de Caja registrado [${mov.tipo}]: S/ ${mov.monto.toFixed(2)} - "${mov.motivo}" por ${mov.cajeroNombre}`);
    res.json({ ok: true, movimiento: mov });
  } catch (err) {
    next(err);
  }
});

// GET /api/caja/movimientos → Listar salidas y movimientos del turno activo o histórico
router.get('/api/caja/movimientos', requierePermiso('Caja', 'Reportes'), validar({ query: consultaMovimientos }), async (req, res, next) => {
  try {
    const { turnoId, desde, hasta } = req.query;
    let whereClause = {};

    if (desde && hasta) {
      // Rango de reportes: el día contable va de 03:00 a 02:59 (hora de Lima)
      const nextDay = new Date(hasta + 'T00:00:00.000-05:00');
      nextDay.setDate(nextDay.getDate() + 1);
      const nextDayStr = nextDay.toISOString().split('T')[0];
      whereClause.creadoEn = {
        gte: new Date(desde + 'T03:00:00.000-05:00'),
        lte: new Date(nextDayStr + 'T02:59:59.999-05:00'),
      };
    } else if (turnoId) {
      whereClause.turnoId = parseInt(turnoId);
    } else {
      const turnoAbierto = await prisma.cierreCaja.findFirst({
        where: { estado: 'ABIERTO' },
        orderBy: { fechaApertura: 'desc' },
      });
      if (!turnoAbierto) {
        return res.json({ ok: true, movimientos: [] });
      }
      whereClause = {
        OR: [
          { turnoId: turnoAbierto.id },
          { creadoEn: { gte: turnoAbierto.fechaApertura } },
        ],
      };
    }

    const movimientos = await prisma.movimientoCaja.findMany({
      where: whereClause,
      orderBy: { creadoEn: 'desc' },
    });
    res.json({ ok: true, movimientos });
  } catch (err) {
    next(err);
  }
});

// POST /api/caja/apertura → Registrar la apertura formal de turno con fondo inicial
router.post('/api/caja/apertura', requierePermiso('Caja'), idempotente, validar({ body: aperturaCaja }), async (req, res, next) => {
  try {
    const { cajeroNombre, montoInicial, notaApertura } = req.body;

    if (!cajeroNombre || !String(cajeroNombre).trim()) {
      return next(new ErrorApp('VALIDACION', 'El nombre del cajero es obligatorio para abrir la caja.', { campo: 'cajeroNombre' }));
    }

    const fondo = parseFloat(montoInicial || 0);

    const nuevoTurno = await prisma.$transaction(async (tx) => {
      // Un solo turno abierto: el candado evita que dos aperturas simultáneas pasen las dos la verificación
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('apertura_caja'))`;
      const turnoExistente = await tx.cierreCaja.findFirst({ where: { estado: 'ABIERTO' } });
      if (turnoExistente) {
        throw new ErrorApp('CAJA_YA_ABIERTA', `Ya existe un turno abierto por "${turnoExistente.cajeroNombre}" desde las ${new Date(turnoExistente.fechaApertura).toLocaleTimeString('es-PE', { timeZone: 'America/Lima' })}. Debe cerrarse antes de abrir uno nuevo.`);
      }
      const turno = await tx.cierreCaja.create({
      data: {
        estado: 'ABIERTO',
        fechaApertura: new Date(),
        fechaCierre: null,
        cajeroNombre: String(cajeroNombre).trim(),
        montoInicial: Math.max(0, isNaN(fondo) ? 0 : fondo),
        notaApertura: notaApertura ? String(notaApertura).trim() : null,
        efectivoVentas: 0,
        efectivoEsperado: 0,
        efectivoContado: 0,
        diferencia: 0,
      },
      });
      await registrarAuditoria(tx, req, {
        accion: 'CAJA_ABIERTA', entidad: 'CierreCaja', entidadId: turno.id, nombreDeclarado: turno.cajeroNombre,
        despues: { cajeroNombre: turno.cajeroNombre, montoInicial: turno.montoInicial }, motivo: turno.notaApertura,
      });
      return turno;
    });

    console.log(`🔓 Turno de Caja ABIERTO por ${cajeroNombre} con Fondo Inicial S/ ${nuevoTurno.montoInicial.toFixed(2)}`);
    res.json({ ok: true, turno: nuevoTurno });
  } catch (err) {
    next(err);
  }
});

// POST /api/caja/cierre → Registrar un arqueo y cierre de turno
router.post('/api/caja/cierre', requierePermiso('Caja'), idempotente, validar({ body: cierreCaja }), async (req, res, next) => {
  try {
    // Del cajero solo se toma lo que él aporta: su nombre, el efectivo que contó y la nota.
    // Los totales del turno y lo esperado en gaveta los calcula el servidor (antes llegaban de la pantalla
    // y alterándolos se podía ocultar un faltante). totalConsumo es informativo: no entra en el efectivo.
    const { cajeroNombre, efectivoContado, totalConsumo, nota } = req.body;

    if (!cajeroNombre) {
      return next(new ErrorApp('VALIDACION', 'El nombre del cajero es obligatorio.', { campo: 'cajeroNombre' }));
    }

    const turnoAbierto = await prisma.cierreCaja.findFirst({
      where: { estado: 'ABIERTO' },
      orderBy: { fechaApertura: 'desc' },
    });

    if (!turnoAbierto) {
      return next(new ErrorApp('CAJA_CERRADA', 'No hay un turno de caja abierto para cerrar. Debe abrir la caja primero.'));
    }

    const fechaCierre = new Date();
    const cierre = await prisma.$transaction(async (tx) => {
      // Solo si sigue abierto: dos cierres a la vez no lo cierran dos veces
      const marcado = await tx.cierreCaja.updateMany({
        where: { id: turnoAbierto.id, estado: 'ABIERTO' },
        data: { estado: 'CERRADO', fechaCierre },
      });
      if (marcado.count !== 1) throw new ErrorApp('CAJA_CERRADA', 'Este turno ya fue cerrado.');

      const r = await resumenDelTurno(turnoAbierto, { hasta: fechaCierre, cliente: tx });
      const esperado = r.efectivoEsperadoEnGaveta;
      // Sin conteo físico se da por bueno lo esperado (sin diferencia)
      const contado = efectivoContado !== undefined && efectivoContado !== null ? Math.max(0, Number(efectivoContado)) : esperado;

      const cerrado = await tx.cierreCaja.update({
        where: { id: turnoAbierto.id },
        data: {
          cajeroNombre: String(cajeroNombre).trim(),
          montoInicial: r.montoInicial,
          efectivoVentas: redondear(r.ventasEfectivo + r.abonosEfectivo),
          efectivoEsperado: esperado,
          efectivoContado: contado,
          diferencia: redondear(contado - esperado),
          totalTarjeta: redondear(r.ventasTarjeta),
          totalYape: redondear(r.ventasYape),
          totalConsumo: Math.max(0, Number(totalConsumo) || 0),
          totalPedidosYa: redondear(r.ventasPedidosYa),
          egresosEfectivo: redondear(r.retirosCaja),
          abonosEfectivo: redondear(r.abonosEfectivo),
          nota: nota ? String(nota).trim() : null,
        },
      });
      await registrarAuditoria(tx, req, {
        accion: 'CAJA_CERRADA', entidad: 'CierreCaja', entidadId: cerrado.id, nombreDeclarado: cerrado.cajeroNombre,
        antes: { estado: 'ABIERTO' },
        despues: {
          estado: 'CERRADO', efectivoEsperado: cerrado.efectivoEsperado, efectivoContado: cerrado.efectivoContado,
          diferencia: cerrado.diferencia, totalTarjeta: cerrado.totalTarjeta, totalYape: cerrado.totalYape,
        },
        motivo: cerrado.nota,
      });
      return cerrado;
    });

    console.log(`🔒 Cierre de Caja registrado exitosamente por ${cajeroNombre}: Esperado S/ ${cierre.efectivoEsperado.toFixed(2)}, Contado S/ ${cierre.efectivoContado.toFixed(2)}, Dif: S/ ${cierre.diferencia.toFixed(2)}`);
    res.json({ ok: true, cierre });
  } catch (err) {
    next(err);
  }
});

// POST /api/caja/cierre-forzado → Cierre administrativo por parte del Administrador
router.post('/api/caja/cierre-forzado', requierePermiso('Caja', 'Dashboard'), idempotente, validar({ body: cierreForzado }), async (req, res, next) => {
  try {
    const { adminPin, motivo } = req.body;

    if (!adminPin || typeof adminPin !== 'string' || !adminPin.trim()) {
      return next(new ErrorApp('AUTORIZACION_REQUERIDA', 'El PIN de Administrador es obligatorio.', { campo: 'pin' }));
    }

    // Validar PIN de administrador
    const admin = await usuarioPorPinAutorizado(req, adminPin, { rol: 'Administrador' });

    if (!admin) {
      return next(new ErrorApp('SIN_PERMISO', 'PIN de Administrador inválido o no autorizado.', { campo: 'pin' }));
    }

    const turnoAbierto = await prisma.cierreCaja.findFirst({
      where: { estado: 'ABIERTO' },
      orderBy: { fechaApertura: 'desc' },
    });

    if (!turnoAbierto) {
      return next(new ErrorApp('CAJA_CERRADA', 'No hay ninguna caja abierta en este momento.'));
    }

    const now = new Date();
    const cierre = await prisma.$transaction(async (tx) => {
      const cerrado = await tx.cierreCaja.update({
        where: { id: turnoAbierto.id },
        data: {
          estado: 'CERRADO',
          fechaCierre: now,
          cerradoPorAdmin: true,
          nota: `[CIERRE FORZADO POR ADMINISTRADOR: ${admin.nombre}] Motivo: ${motivo || 'Cierre de turno por administración'}`,
        },
      });
      await registrarAuditoria(tx, req, {
        accion: 'CAJA_CIERRE_FORZADO', entidad: 'CierreCaja', entidadId: cerrado.id,
        antes: { estado: 'ABIERTO', cajeroNombre: turnoAbierto.cajeroNombre }, despues: { estado: 'CERRADO' },
        motivo: motivo || null, autorizadoPor: admin.nombre,
      });
      return cerrado;
    });

    console.log(`⚠️ Turno #${turnoAbierto.id} cerrado administrativamente por Admin ${admin.nombre}`);
    res.json({ ok: true, mensaje: 'Turno cerrado forzosamente por Administrador con éxito.', cierre });
  } catch (err) {
    next(err);
  }
});

// GET /api/caja/ultimo-cierre → Obtener el último cierre de caja registrado
router.get('/api/caja/ultimo-cierre', requierePermiso('Caja', 'Dashboard'), async (req, res, next) => {
  try {
    const ultimo = await prisma.cierreCaja.findFirst({
      where: { estado: 'CERRADO' },
      orderBy: { fechaCierre: 'desc' },
    });
    res.json({ ok: true, ultimoCierre: ultimo });
  } catch (err) {
    next(err);
  }
});

// GET /api/caja/cierres → Historial de los últimos cierres de caja
router.get('/api/caja/cierres', requierePermiso('Caja', 'Reportes'), validar({ query: consultaCierres }), async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit || 30);
    const cierres = await prisma.cierreCaja.findMany({
      orderBy: { id: 'desc' },
      take: Math.min(limit, 100),
    });
    res.json({ ok: true, cierres });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
