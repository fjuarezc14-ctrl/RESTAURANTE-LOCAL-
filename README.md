# VALETEC GOURMET - Sistema POS & Gastronómico Local

Sistema integral de gestión de restaurantes, comandas de salón, monitor KDS de cocina y barra, facturación electrónica y punto de cobro (POS) optimizado para funcionamiento 100% local y offline.

---

## 🚀 Puertos y Aislamiento de Servicios Locales

| Componente | Puerto Local | Contenedor Docker | URL Local |
|---|---|---|---|
| **Frontend Web** | `5188` | `restaurante-local-web-1` | `http://localhost:5188` |
| **Backend API** | `3010` | `restaurante-local-backend-1` | `http://localhost:3010` |
| **Base de Datos PostgreSQL** | `5445` | `restaurante-local-db-1` | `localhost:5445` |

---

## ⚡ Inicio Rápido (1 Clic en Windows)

Haz doble clic en el archivo:
```text
INICIAR_SISTEMA_LOCAL.bat
```
El script detectará automáticamente la dirección IP local de la computadora para que los mozos puedan conectarse de inmediato desde sus teléfonos celulares vía Wi-Fi (`http://<IP_LOCAL>:5188`).

---

## 🛠️ Comandos Manuales con Docker

```bash
# Iniciar contenedores en segundo plano
docker compose up -d

# Sincronizar base de datos con Prisma
docker exec restaurante-local-backend-1 npx prisma db push

# Inicializar datos limpios de fábrica
docker exec restaurante-local-backend-1 npm run db:seed:clean
```

---

## 🔐 Accesos Iniciales

- **Administrador:** PIN `1234`
- **Mesas:** 12 mesas configuradas por defecto en salón.
