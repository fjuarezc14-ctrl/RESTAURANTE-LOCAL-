# Guía de continuidad — Valetec POS (sede La Carreta)

Resumen de lo trabajado entre el 21 y el 23 de setiembre de 2026, con el porqué de cada decisión.
Está pensado para alguien que va a seguir modificando el código sin haber estado en esas sesiones.

---

## 1. Cómo está armado

| Capa | Qué es | Dónde |
|---|---|---|
| Frontend | React 19 + Vite + Tailwind 4 | `src/` |
| Backend | Express + Prisma | `backend/server.js` (archivo único, ~4.400 líneas) |
| Base de datos | PostgreSQL | `backend/prisma/schema.prisma` |
| Instalador Windows | Node + NSIS | `installer/` |

**Dos formas de correrlo:**

- **Desarrollo:** `docker compose up -d --build`. Vite sirve el frontend en el puerto 5188 y el backend corre en el 3010.
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

**Si hay que reactivar la facturación electrónica:** poner las constantes en `true`, devolver el llamado a `obtenerSiguienteSerieYNumero` y a `enviarAApisunat` en `POST /api/ventas` y `POST /api/pedidos/llevar`, y reactivar el `setInterval` del worker. Ojo con el punto 4.2.

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

Cuando una opción tiene `productoId`, el backend crea un ítem aparte de precio 0 con ese producto. Eso hace tres cosas de golpe: llega a la estación correcta (cocina o barra, según la categoría del producto), descuenta su stock, y aparece en los reportes de rotación. Antes las bebidas se adivinaban leyendo el texto de las notas y, si el texto no coincidía con ningún producto, terminaban en cocina.

La lógica compartida está en **`src/utils/combos.js`**, usada por Carta (para configurar), y por Salón y Caja (para comandar). Si agregas comportamiento, ponlo ahí: Salón y Caja son dos copias casi idénticas y es fácil que queden desincronizadas.

### 2.3 Expansión del pedido (lo más delicado del backend)

`expandPedidoItemsForDb()` recibe lo que manda el frontend y devuelve la lista real de ítems a guardar:

1. El plato principal, con su precio.
2. Sus `componentes`, a precio 0.
3. Las opciones elegidas que apuntan a un producto, a precio 0.
4. Si no hubo opciones enlazadas, el camino viejo: deducir la bebida leyendo las notas.

Todo lo agregado en los pasos 2, 3 y 4 se marca con **`esComponente: true`**. Esa marca es importante:

- **Cocina y barra sí ven** esos ítems: son cosas que hay que preparar.
- **El ticket y la venta no los listan**, porque ya están pagados dentro del combo.

Antes se distinguían por `precio > 0`, y eso rompió cuando cargamos la carta de La Carreta con todos los precios en S/ 0: las ventas salían "SIN ÍTEMS". Si tocas filtros de ítems, usa `esComponente`, nunca el precio.

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

Detalles que costaron:

- La bandeja del mozo **excluía las categorías de barra**, así que las bebidas se preparaban y nadie las iba a recoger. Ahora incluye ambas estaciones y cada ítem muestra de dónde recogerlo.
- El aviso sonoro se disparaba solo cuando la mesa entera pasaba a "Servido". Ahora se compara ítem por ítem contra el estado anterior (`prevMesasRef`) y avisa apenas cocina o barra despacha algo.
- En pedidos **para llevar**, `PATCH /api/pedidos/:id/preparar` marcaba *todos* los ítems sin importar la estación, así que cuando cocina despachaba, la barra perdía de vista las bebidas. Ahora cada estación despacha lo suyo, igual que en salón.

---

## 3. Marca blanca y el instalador

### 3.1 La marca sale de la base de datos

`EmpresaConfig` (nombre, RUC, dirección, pie de ticket) se edita en **Datos de Empresa**. El detalle: los tickets y reportes leen el objeto **estático** `COMPANY_CONFIG` en 33 lugares. Para no tocar los 33, `CompanyContext` hace `Object.assign(COMPANY_CONFIG, datosDelServidor)` al cargar. Antes los tickets imprimían "VALETEC GOURMET" y un RUC de ejemplo aunque cambiaras la configuración.

El nombre en el login y el menú lateral usa `splitBrand(empresa.brandShort)`: resalta la última palabra ("LA **CARRETA**").

### 3.2 Un cliente = una carpeta

```
installer/clientes/la-carreta/
├── cliente.json        empresa + usuarios (sin PINs, esto sí va a git)
├── carta.json          111 productos con precio en S/ 0
├── logo.png            512×512 transparente
├── icon.ico            icono del instalador
└── pins.local.json     PINs generados (NO va a git)
```

Los PINs se generan al azar la primera vez y se reutilizan en cada build, para que las credenciales entregadas no cambien. Si el archivo no existe, se generan otros: para que dos personas compilen el mismo instalador, hay que pasarse `pins.local.json` por fuera del repositorio.

### 3.3 El instalador

`./installer/build.sh <cliente>` (que llama a `installer/build.mjs`) arma en `installer/build/stage/` un árbol que se instala tal cual en `C:\ValetecPOS`:

```
node/node.exe        Node portable
pgsql/               PostgreSQL portable (sin pgAdmin)
app/backend/         backend + node_modules con motores de Prisma para Windows
app/dist/            frontend compilado
setup/               setup.js, uninstall.js, WinSW, VC++ redist, cliente.json, carta.json
```

Después ofusca el código propio (`javascript-obfuscator`) y compila el `.exe` con NSIS (`installer/valetec.nsi`). En Linux usa `makensis` si está instalado; si no, lo hace dentro de un contenedor Debian.

**`installer/setup/setup.js` es el corazón de la instalación** y corre en la PC del cliente: crea el cluster de PostgreSQL con contraseña aleatoria, registra dos servicios de Windows, aplica migraciones, siembra los datos y abre el puerto en el firewall. Es idempotente: reinstalar encima **conserva la base de datos**.

Dos defensas que están ahí por errores reales de instalación:

1. Si Windows niega el arranque de PostgreSQL con NetworkService (pasa cuando se instala dentro de `C:\Users\...`), **reintenta registrando el servicio con la cuenta del sistema**.
2. Si una instalación falla a medias deja una marca (`base-sin-configurar.tmp`); la siguiente detecta esa base incompleta y la rehace. Una base **con ventas nunca se toca**: se detiene y avisa.

---

## 4. Deuda técnica y trampas conocidas

### 4.1 Seguridad: la API no tiene autenticación

Cualquier dispositivo en el WiFi puede llamar a la API. Y `GET /api/usuarios` **devuelve los PIN en texto plano**, incluido el del administrador. La pantalla de Usuarios los muestra a propósito, así que quitarlos de la respuesta obliga a rediseñar esa pantalla. Mientras tanto: red WiFi solo para el personal.

Los PIN se guardan sin hash. Si alguna vez se hashean, hay que migrar `Usuario.pin` y todos los `findFirst({ where: { pin } })`.

### 4.2 Correlativos

`obtenerSiguienteSerieYNumero()` usa `pg_advisory_xact_lock` sobre la serie, porque con `MAX(numero)+1` a secas 11 cobros simultáneos generaron 9 números repetidos. Hoy no se usa (solo tickets), pero si se reactiva la facturación, **mantener ese bloqueo** y considerar un índice único sobre `(serie, numero)`.

### 4.3 Cierre de caja: no guarda nada

El botón "Cerrar Turno" muestra el faltante o sobrante en pantalla, pero **no lo persiste**: solo escribe una fecha en el `localStorage` de ese navegador, así que cada equipo ve un corte distinto. Falta una tabla `CierreCaja` (fecha, usuario, esperado, contado, diferencia, totales por método) y leer el último cierre desde la base. **Está pendiente y acordado con el cliente.**

### 4.4 Lógica duplicada

`SalonPage.jsx` (2.500 líneas) y `CajaPage.jsx` (6.500 líneas) tienen dos copias del asistente de opciones, del armado de notas y de los combos legacy. Hay combos escritos a mano de otro cliente (`PRODUCT_OPTIONS_CONFIG`: "Combo Criollo", "Combo Parrillero") y un trato especial a la categoría "Menú". Si un producto se llama igual que uno de esos, se activa esa lógica vieja. Conviene borrarla y unificar en `src/utils/combos.js`.

### 4.5 Otras cosas anotadas

- **Cambiar el método de pago** de una venta recalcula el total desde los ítems y **pierde el descuento** aplicado.
- **Nombres de productos únicos:** el backend busca productos por nombre. En la carta de La Carreta esto obligó a renombrar: los del menú llevan "Menú" adelante, los de Carta Oriental llevan "(Carta Oriental)", y los tallarines verdes se llaman "Tallarín Verde con …" (eso además activa el agrupador de variantes de Salón).
- **Reporte de pollos:** contaba un pollo entero por cada plato con "pollo" en el nombre. Ahora solo cuenta las categorías de brasa y mostritos.
- **Sin backup antes de actualizar:** el instalador aplica migraciones sin respaldar. Falta un `pg_dump` previo.
- **El `.exe` no está firmado:** Windows muestra "Windows protegió su PC" y un antivirus podría bloquear una futura actualización automática.
- **Consulta de DNI/RUC:** el endpoint `/api/clientes/consulta/:doc` **inventa nombres** ("CLIENTE DNI 12345678") cuando no hay token. Ya no se usa en Caja, pero sigue vivo en el backend.

---

## 5. Comandos frecuentes

```bash
# Instalador de un cliente (Linux; requiere makensis o Docker)
./installer/build.sh la-carreta

# Cargar la carta en una instalación existente (no duplica ni pisa precios)
node backend/scripts/importar-carta.js installer/clientes/la-carreta/carta.json

# En la PC del restaurante (Windows)
cd C:\ValetecPOS\app\backend
..\..\node\node.exe scripts\importar-carta.js ..\..\setup\carta.json
```

Los commits van en español, breves, con Conventional Commits, y sin línea de coautor.
