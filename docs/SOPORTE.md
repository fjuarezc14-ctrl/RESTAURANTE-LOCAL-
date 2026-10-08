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
