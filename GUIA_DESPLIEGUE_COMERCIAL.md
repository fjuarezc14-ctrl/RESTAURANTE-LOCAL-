# 📘 Guía de Despliegue y Venta Comercial: POS Gastronómico (Marca Blanca)

Esta guía explica paso a paso cómo empaquetar, instalar y configurar este sistema para **venderlo a cualquier nuevo restaurante, bar, cevichería, pizzería o cafetería**.

---

## 1. Modelos de Venta Recomendados

| Modalidad | Precio Sugerido | Descripción |
|---|---|---|
| **Venta por Instalación Local (Licencia de por vida)** | \$350 – \$600 USD (Pago único) + \$30 USD/mes de soporte opcional | Se instala en la computadora principal del restaurante usando Docker. Los mozos se conectan por la red WiFi del local desde sus celulares. |
| **Suscripción en la Nube (VPS dedicado)** | \$35 – \$60 USD / mes | Se levanta en un VPS (DigitalOcean, Hetzner, AWS) con dominio propio del cliente (ej. `pos.mirestaurante.pe`). |

---

## 2. Requisitos Previos en el Local del Cliente

1. **Computadora Servidor / Caja:**
   - Windows 10/11 o Linux.
   - Mínimo 8 GB de RAM y procesador Core i3 / Ryzen 3 o superior.
   - Docker Desktop instalado.
2. **Red WiFi Local:**
   - Un router WiFi estable donde los mozos y la caja estén en la misma red local (ej. `192.168.1.X`).
3. **Hardware Opcional:**
   - Ticketera térmica USB o de red (80mm o 58mm).
   - Gaveta de dinero conectada a la ticketera (conector RJ11).
   - Tablets o smartphones para mozos.

---

## 3. Pasos de Instalación para un Nuevo Cliente

### Paso 1: Clonar o copiar el proyecto en la PC del cliente
Copia la carpeta del sistema en la computadora del cliente (ej. `C:\SISTEMA-POS`).

### Paso 2: Configurar las variables del cliente (`.env`)
En el archivo `.env` del backend, ajusta los datos básicos:
```env
COMPANY_NAME="Nombre del Nuevo Restaurante"
BRAND_SHORT="MI RESTAURANTE"
COMPANY_RUC="20123456789"
TIPO_NEGOCIO="restaurante" # opciones: polleria, restaurante, bar, pizzeria, cafeteria
INITIAL_ADMIN_PIN="1234"
```

### Paso 3: Levantar los contenedores
Abre una terminal en la carpeta del proyecto y ejecuta:
```bash
docker compose up -d --build
```

### Paso 4: Inicializar la Base de Datos en Modo Limpio (Puesta en Marcha)
Ejecuta el script de inicialización limpia para que el sistema quede en cero sin datos de prueba anteriores:
```bash
docker exec restaurante-hernandez-backend-1 npm run db:seed:clean
```
Esto creará automáticamente:
- **Usuario Administrador:** `Administrador` | **PIN:** `1234`
- **Mesas:** 12 mesas en estado libre
- **Carta:** Vacía y lista para registrar platos
- **Movimientos:** Caja, ventas y auditorías en cero

---

## 4. Configuración en la Interfaz Web (Primera Vez)

Una vez iniciado el sistema, abre el navegador en `http://localhost:5177` e ingresa con el PIN `1234`:

1. **Menú Configuración:**
   - Coloca la **Razón Social**, **RUC oficial** y **Dirección** del cliente.
   - Selecciona el **Tipo de Establecimiento Gastronómico** (*Pollería*, *Restaurante Criollo*, *Pizzería*, *Bar*, *Cafetería*).
   - Define qué categorías se despachan a **Barra** (el resto irá automáticamente a Cocina).
   - Personaliza el **Pie de Ticket** de despedida.

2. **Menú Usuarios:**
   - Cambia el PIN del Administrador.
   - Registra a los mozos y cajeros con sus respectivos nombres y PINs personales de 4 dígitos.

3. **Menú Carta:**
   - Registra las categorías y platos del cliente con sus respectivos precios.
   - Para platos con guarnición o combos (ej. término de carne, sopas o bebidas), activa el selector de guarnición u opciones.

4. **Menú Salón:**
   - Comprueba las mesas. Puedes agregar o quitar mesas según la distribución del salón del cliente.

---

## 5. Conexión de los Celulares de los Mozos (Red Local)

Para que los mozos tomen pedidos desde sus celulares sin internet externo:
1. En la PC del restaurante, abre PowerShell y escribe `ipconfig` para conocer la IP local (ej. `192.168.1.45`).
2. En el celular del mozo, abre Chrome o Safari y escribe:
   ```
   http://192.168.1.45:5177
   ```
3. En el navegador del celular, selecciona **"Agregar a la pantalla principal"**.
   - Aparecerá el ícono del sistema como si fuera una aplicación nativa.
   - El mozo solo presiona su PIN y comienza a comandar de inmediato.
