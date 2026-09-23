# Guía de continuidad — Valetec POS (sede La Carreta)

Resumen de lo trabajado entre el 21 y el 24 de setiembre de 2026, con el porqué de cada decisión.
Está pensado para alguien que va a seguir modificando el código sin haber estado en esas sesiones.

---

## 1. Cómo está armado

| Capa | Qué es | Dónde |
|---|---|---|
| Frontend | React 19 + Vite + Tailwind 4 | `src/` |
| Backend | Express + Prisma | `backend/server.js` (archivo único, ~4.900 líneas) |
| Base de datos | PostgreSQL | `backend/prisma/schema.prisma` |
| Reportes Excel | XML Office Excel con estilos contables | `src/pages/ReportesPage.jsx` |
| Instalador Windows | Node + NSIS | `installer/` |

**Dos formas de correrlo:**

- **Desarrollo:** `docker compose up -d --build`. Vite sirve el frontend en el puerto 5188 y el backend corre en el 3015 (mapeado al contenedor).
- **Producción (restaurante):** un solo proceso Node. El backend detecta la carpeta `dist/` y sirve el frontend en el mismo puerto (5188), así que no hay CORS ni proxy. Ver el bloque final de `server.js`.

Después de un `git pull` con migraciones nuevas, en desarrollo hay que correr:

```bash
docker exec restaurante-local-backend-1 npx prisma migrate deploy
docker exec restaurante-local-backend-1 npx prisma generate
docker restart restaurante-local-backend-1
```

El `prisma generate` es obligatorio: el cliente vive en un volumen del contenedor y no se regenera solo.

---

## 2. Reglas de negocio que conviene entender antes de tocar nada

### 2.1 Solo se emiten tickets de venta

La empresa emite la boleta o factura **por su cuenta en el portal de SUNAT**. El sistema ya no genera comprobantes electrónicos.

- En el frontend hay una constante `FACTURACION_ELECTRONICA = false` en `CajaPage.jsx` y en `ReportesPage.jsx`. Apaga el QR de SUNAT, los estados de envío y el enlace al PDF.
- El backend **fuerza** `tipoComprobante: 'Ticket'`, con `serie` y `numero` en `null` y `estadoSunat: 'NO_APLICA'`, sin importar lo que mande el frontend. Es a propósito: evita que una pantalla vieja o una llamada manual generen comprobantes.
- El worker que reintentaba envíos a SUNAT está desactivado (`void procesarVentasPendientes`). La función y los endpoints `/api/sunat/*` siguen existiendo por si algún día se reactiva.
- El ticket impreso ya no muestra IGV desglosado, código hash ni serie tipo SUNAT: lleva "N° 0002" y la leyenda de que no es comprobante de pago.

### 2.2 Cómo se arma un plato

Un `Producto` puede tener tres cosas, combinables:

| Campo | Para qué | Formato |
|---|---|---|
| `opcionesConfig` | Pasos que el mozo responde al comandar (elige la sopa, el término, la bebida) | `[{name, key, options:[...]}]` |
| `componentes` | Combo armado uniendo productos de la carta | `[{productoId, cantidad}]` |
| `complementos` | El "incluye" del plato y los extras con precio | `[{nombre, incluido, precio}]` |

Las **opciones** pueden ser texto libre o estar enlazadas a un producto:

```json
{ "label": "Chicha Morada", "value": "Chicha Morada", "productoId": 12, "precioExtra": 0 }
```

Cuando una opción tiene `productoId`, el backend crea un ítem aparte de precio 0 con ese producto. Eso hace tres cosas de golpe: llega a la estación correcta (cocina o barra, según la categoría del producto), descuenta su stock, y aparece en los reportes de rotación.

La lógica compartida está en **`src/utils/combos.js`**, usada por Carta (para configurar), y por Salón y Caja (para comandar).

### 2.3 Expansión del pedido (lo más delicado del backend)

`expandPedidoItemsForDb()` recibe lo que manda el frontend y devuelve la lista real de ítems a guardar:

1. El plato principal, con su precio.
2. Sus `componentes`, a precio 0.
3. Las opciones elegidas que apuntan a un producto, a precio 0.
4. Si no hubo opciones enlazadas, el camino viejo: deducir la bebida leyendo las notas.

Todo lo agregado en los pasos 2, 3 y 4 se marca con **`esComponente: true`**. Esa marca es importante:
- **Cocina y barra sí ven** esos ítems: son cosas que hay que preparar.
- **El ticket y la venta no los listan**, porque ya están pagados dentro del combo.

**El stock se descuenta sobre la lista expandida**, así que un combo descuenta cada componente por separado.

### 2.4 Flujo de una comanda

```
Mozo comanda  →  pedido.estado = 'Cocina'
                 cada ítem: historial=false, entregado=false
                      ↓
Cocina y barra despachan LO SUYO (filtrado por categoría del producto)
                 ítem: historial=true       → aparece en la bandeja del mozo + aviso
                      ↓
Mozo lleva a la mesa
                 ítem: entregado=true       → sale de la bandeja
                      ↓
Cuando TODOS los ítems tienen historial=true → pedido 'Servido' y mesa azul
                      ↓
Caja cobra → pedido 'Cobrado', mesa 'Libre', se crea la Venta
```

---

## 3. Cierre y Apertura de Caja (Implementado el 24/09/2026)

Antes el cierre vivía en el `localStorage` de cada navegador: si abrías el sistema desde otra máquina, no existía corte y los números no coincidían. Hoy el ciclo de caja está **completamente persistido en PostgreSQL** y sincronizado en toda la red local.

### 3.1 Modelo de datos: `CierreCaja`

Se migraron los siguientes campos en `backend/prisma/schema.prisma`:

| Campo | Tipo | Qué guarda |
|---|---|---|
| `id` | `Int` (Autoincrement) | ID único del turno/cierre |
| `estado` | `String` (`"ABIERTO"` / `"CERRADO"`) | Estado operativo del turno |
| `fechaApertura` | `DateTime` | Momento exacto en que se inició el turno |
| `fechaCierre` | `DateTime?` | Momento de cierre (nulo mientras la caja está abierta) |
| `cajeroNombre` | `String` | Nombre del personal responsable del turno |
| `montoInicial` | `Float` (default `0`) | Sencillo en efectivo ingresado en gaveta |
| `notaApertura` | `String?` | Observaciones al abrir (ej. desglose de billetes) |
| `efectivoEsperado`| `Float` | Fondo inicial + Ventas efectivo + Abonos - Egresos |
| `efectivoContado` | `Float` | Dinero físico contado por el cajero al cuadrar |
| `diferencia` | `Float` | Cuadre exacto (0), sobrante (+) o faltante (-) |
| `cerradoPorAdmin` | `Boolean` (default `false`) | `true` si fue cerrado por el Administrador |
| `nota` | `String?` | Motivo de auditoría o justificación del cierre |

### 3.2 Ciclo de vida y Endpoints (`/api/caja/...`)

1. **Apertura de Turno (`POST /api/caja/apertura`):**
   - El cajero ingresa su nombre, el fondo inicial de sencillo (atajos de S/ 0, S/ 50, S/ 100, S/ 150 o personalizado) y una nota opcional.
   - La API bloquea la creación si ya existe otro turno en estado `"ABIERTO"`.
2. **Estado en Tiempo Real (`GET /api/caja/estado`):**
   - Retorna si la caja está abierta o cerrada, el objeto del turno activo y el cálculo en vivo de gaveta:
     $$\text{Efectivo en Gaveta} = \text{Fondo Inicial} + \text{Ventas Efectivo} + \text{Abonos} - \text{Egresos}$$
3. **Bloqueo Operativo (Gate en Frontend):**
   - En `CajaPage.jsx`, si la caja está cerrada, se muestra un banner superior rojo y se bloquea el cobro de mesas o la creación de pedidos delivery hasta abrir la caja. Al intentar cobrar, salta el modal de apertura.
4. **Arqueo y Cierre Regular (`POST /api/caja/cierre`):**
   - El cajero abre el modal de cierre, ingresa su conteo físico de billetes/monedas.
   - El ticket térmico muestra claramente el **Fondo Inicial (Apertura)** sumado a las ventas del turno.
   - Al confirmar, actualiza el registro a `"CERRADO"`, guarda los totales consolidados y resetea el estado para el siguiente turno.
5. **Cierre Forzado por Administrador (`POST /api/caja/cierre-forzado`):**
   - Permite al Administrador cerrar una caja abierta desde `DashboardPage.jsx` si el cajero se retiró o culminó su jornada.
   - Valida el PIN de Administrador (base de datos: `Usuario` con rol `'Administrador'`), audita el motivo y el nombre del admin.

---

## 4. Trazabilidad de Ventas por Cajero y Reportes en Excel

### 4.1 Identificación de Cajero en Ventas
- Se agregó `cajeroNombre String?` al modelo `Venta` (migración `20260924020000_venta_cajero_nombre`).
- Cada cobro de mesa o delivery guarda el cajero activo en la venta.
- En `ReportesPage.jsx` existe la pestaña **"Ventas por Cajero"**: compara número de tickets emitidos, monto total recaudado, cobros en efectivo vs medios digitales y créditos colocados por cada colaborador.

### 4.2 Formato Profesional de Reportes en Excel
Los reportes exportables en `ReportesPage.jsx` y `ComprasPage.jsx` migraron de CSV básico a hojas de cálculo con marcado XML de Microsoft Office Excel (`xmlns:x="urn:schemas-microsoft-com:office:excel"`):
- Se generan en el cliente en milisegundos sin sobrecargar el servidor ni requerir paquetes pesados adicionales en Node.
- Encabezados corporativos con paleta ejecutiva (azul marino y slate).
- Formato contable con separador de miles y dos decimales (`"S/ #,##0.00"`).
- Fechas y horas formateadas en columnas separadas.
- Filas de totales calculadas mediante fórmulas nativas de Excel (`SUM(...)`), con bordes dobles contables.

---

## 5. Marca blanca y el instalador

### 5.1 La marca sale de la base de datos

`EmpresaConfig` (nombre, RUC, dirección, pie de ticket) se edita en **Datos de Empresa**. Para no tocar 33 llamadas estáticas, `CompanyContext` hace `Object.assign(COMPANY_CONFIG, datosDelServidor)` al cargar.

El nombre en el login y el menú lateral usa `splitBrand(empresa.brandShort)`: resalta la última palabra ("LA **CARRETA**").

### 5.2 Un cliente = una carpeta

```
installer/clientes/la-carreta/
├── cliente.json        empresa + usuarios (sin PINs, esto sí va a git)
├── carta.json          111 productos con precio en S/ 0
├── logo.png            512×512 transparente
├── icon.ico            icono del instalador
└── pins.local.json     PINs generados (NO va a git)
```

Los PINs se generan al azar la primera vez y se reutilizan en cada build.

### 5.3 El instalador

`./installer/build.sh <cliente>` compila en `installer/build/stage/`:
- Node portable + PostgreSQL portable (sin pgAdmin).
- Backend Express + Frontend compilado (`dist/`).
- `installer/setup/setup.js`: crea cluster, servicios de Windows, corre migraciones de Prisma y abre firewall. **Reinstalar encima conserva la base de datos intacta.**

---

## 6. Deuda técnica y trampas conocidas

### 6.1 Seguridad: la API no tiene autenticación por tokens

Cualquier dispositivo en la red WiFi local puede hacer peticiones a la API. Y `GET /api/usuarios` devuelve los PINs en texto plano porque la pantalla de administración los muestra. Red WiFi exclusiva para el personal del restaurante.

### 6.2 Cierre de caja en bases antiguas

En instalaciones viejas donde ya existían filas en `CierreCaja`, el campo `estado` se pobló automáticamente con `'CERRADO'`, por lo que el sistema arranca de forma limpia exigiendo apertura formal del primer turno.

### 6.3 Lógica duplicada en frontend

`SalonPage.jsx` (~2.500 líneas) y `CajaPage.jsx` (~7.000 líneas) tienen copias del asistente de opciones y combos. Se recomienda seguir centralizando lógica compartida en `src/utils/combos.js`.

---

## 7. Comandos frecuentes

```bash
# Correr en desarrollo (Docker)
docker compose up -d

# Desplegar migraciones nuevas en desarrollo
docker compose exec backend npx prisma migrate deploy
docker compose exec backend npx prisma generate
docker compose restart backend

# Compilar frontend
docker compose exec web npm run build

# Probar estado de caja
curl -s http://localhost:3015/api/caja/estado

# Instalador de un cliente (Linux; requiere makensis o Docker)
./installer/build.sh la-carreta
```

Los commits van en español, breves, con Conventional Commits, y **NUNCA ejecutar git push a main sin orden directa del usuario**.
