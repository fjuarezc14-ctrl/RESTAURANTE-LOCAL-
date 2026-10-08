# Soporte — acceso al sistema

Qué hacer cuando un restaurante no puede entrar. Pensado para el equipo de VALETEC, que tiene acceso al servidor.

---

## 1. Cómo funciona el acceso

| Paso | Cuándo | Qué se pide |
|---|---|---|
| Activar el equipo | Una vez por tablet, celular o PC (dura 180 días desde el último uso) | Usuario o correo + contraseña + nombre del equipo |
| Entrar | Todos los días | Solo el PIN de 4 dígitos |

- **Un solo usuario con contraseña basta** (normalmente el administrador) para activar todos los equipos. En un equipo activado entra cualquier empleado con su PIN.
- **Los PIN y las contraseñas no se pueden ver**, ni desde la app ni en la base de datos: solo se guarda su hash. Si alguien los olvida, se asigna uno nuevo.

---

## 2. Qué hacer si alguien olvida su acceso

| Qué se olvidó | Solución |
|---|---|
| El PIN de un empleado | El administrador le asigna uno nuevo en **Usuarios** |
| La contraseña de un empleado | El administrador le asigna una nueva en **Usuarios** |
| La contraseña de un administrador, y hay otro administrador con contraseña | El otro se la cambia en **Usuarios** |
| La contraseña del **único** administrador | **Script de rescate** (abajo) |

Olvidar la contraseña no saca a nadie del sistema: los equipos ya activados siguen entrando con PIN. La contraseña solo hace falta para activar un equipo nuevo.

---

## 3. Script de rescate: `restablecer-admin.js`

Pone una contraseña nueva a **un solo** administrador, el que se elija. Las sesiones abiertas y los equipos ya activados siguen funcionando.

**1. Ver los administradores:**

```bash
docker compose --env-file .env.<cliente> exec backend node scripts/restablecer-admin.js
```

**2. Restablecer uno** (por su usuario o su ID). Si no se indica la contraseña, se genera una al azar y se muestra:

```bash
docker compose --env-file .env.<cliente> exec backend node scripts/restablecer-admin.js admin
docker compose --env-file .env.<cliente> exec backend node scripts/restablecer-admin.js admin "clave-nueva-123"
```

**En la instalación de Windows**, desde la carpeta del backend instalado:

```bat
node scripts\restablecer-admin.js admin
```

Pide al administrador que cambie la contraseña después de entrar.

---

## 4. Primer arranque de un cliente nuevo

- **`PIN_SECRET`**: hay que definirlo en el `.env.<cliente>` **antes del primer arranque** y no cambiarlo nunca. Con él se guardan los PIN; si cambia, ningún PIN vuelve a coincidir y hay que asignarlos todos de nuevo. Se genera con `openssl rand -base64 32`.
- **Acceso inicial**: al primer arranque, el primer administrador recibe el usuario `admin` y la contraseña de `INITIAL_ADMIN_PASSWORD`. Si no está definida, se genera una y se muestra **una sola vez** en el log:

  ```bash
  docker compose --env-file .env.<cliente> logs backend | grep "Acceso para activar"
  ```

  Si se perdió, usar el script de rescate.

Las demás variables están explicadas en `backend/.env.example`.

## 5. Instalación en un servidor (versión web)

En el servidor **nunca** se usa `docker-compose.yml`: ese levanta Vite en modo desarrollo, que consume CPU todo el tiempo (fue lo que llevó el servidor de Fogón al 100 %). Se usa `docker-compose.prod.yml`, que compila la web una vez y la sirve con nginx:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.<cliente> up -d --build
```

- Usa el mismo nombre de proyecto y el mismo volumen que el de desarrollo: los datos se conservan.
- La base y el backend solo escuchan en `127.0.0.1`; los navegadores entran por nginx (`WEB_PORT`).
- En el `.env.<cliente>` del servidor, además de lo de la sección 4: `DB_PASSWORD` propio **antes del primer arranque** (después ya no cambia la clave de la base).
- `MODO_INSTALACION=web` solo si el sitio va detrás de HTTPS. En ese modo las cookies de sesión son `Secure` y por HTTP simple el navegador no las envía: nadie podría entrar.
- Actualizar: `git pull` y el mismo comando con `--build`.
- Con dominio propio: agregar `-f docker-compose.https.yml` (Caddy saca el certificado HTTPS solo). Plantilla completa: `.env.la-carreta-web.example`.

## 6. Actualizar el local (Windows) y mudarlo a la web

### Actualizar la PC del local
1. Compilar: `./installer/build.sh <cliente>`. Deja en `installer/dist/` el `.exe` y `CREDENCIALES-<cliente>.txt`.
2. Ejecutar el `.exe` en la PC del local **fuera de horario**. Instala encima: conserva la base, los PIN y el `.env`.
3. Antes de tocar la base, el instalador saca un respaldo en `C:\ValetecPOS\respaldos\antes-de-actualizar-<fecha>.dump`. Si el respaldo falla, se detiene sin cambiar nada.
4. Desde la 1.1.0 cada equipo se activa una vez con usuario `admin` y la contraseña de `CREDENCIALES-<cliente>.txt`. Si el administrador ya tenía contraseña, sigue valiendo esa.
5. Si algo falla: `C:\ValetecPOS\logs\instalacion.log`.

### Pasar la base a la versión web
1. En el local: menú Inicio → Valetec POS → **Sacar respaldo**. Deja un `.dump` en `C:\ValetecPOS\respaldos`.
   (En una versión 1.0.0, que no tiene ese acceso directo, desde una consola de administrador:
   `C:\ValetecPOS\pgsql\bin\pg_dump.exe -h localhost -p 5446 -U postgres -d restaurante_local -Fc --no-owner -f C:\respaldo.dump`,
   con la contraseña que está en `DATABASE_URL` de `C:\ValetecPOS\app\backend\.env`.)
2. Abrir `C:\ValetecPOS\app\backend\.env`. Si tiene **`PIN_SECRET`**, copiar ese valor: sin el mismo secreto ningún PIN funciona en la web.
   Si **no** lo tiene (instalaciones 1.0.0, como La Carreta), los PIN están sin cifrar: en el servidor se usa uno nuevo (`openssl rand -base64 32`).
3. En el servidor: `cp .env.la-carreta-web.example .env.la-carreta-web` y completar `DOMINIO`, `DB_PASSWORD`, `PIN_SECRET` e `INITIAL_ADMIN_PASSWORD`.
4. Subir el `.dump` al servidor y ejecutar `./scripts/importar-respaldo.sh .env.la-carreta-web respaldo.dump`.
   El script se niega si la base web ya tiene ventas; con `--reemplazar` respalda la actual en `respaldos/` y la pisa.
5. Entrar a `https://<dominio>` y activar cada equipo de nuevo (usuario `admin`). Los PIN son los mismos del local.
6. Mientras la web no esté confirmada, no vender en las dos a la vez: lo que se venda en el local después del respaldo no pasa a la web.
