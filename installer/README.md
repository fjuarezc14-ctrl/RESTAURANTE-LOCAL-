# Generar el instalador (.exe)

El instalador se genera igual en **Windows** y en **Linux** con un solo script (`build.mjs`).

## Requisitos

| | Windows | Linux |
|---|---|---|
| Node.js 20 o superior | [nodejs.org](https://nodejs.org) (versión LTS) | igual |
| Git | [git-scm.com](https://git-scm.com) | igual |
| NSIS | **No hace falta**: se descarga solo | `makensis` instalado, o Docker |

La primera vez descarga ~360 MB (Node, PostgreSQL, Visual C++, WinSW, NSIS) y los guarda en `installer/cache/`. Las siguientes compilaciones son más rápidas.

## Compilar

**Windows** (CMD o PowerShell, desde la carpeta del proyecto):

```bat
git clone https://github.com/fjuarezc14-ctrl/RESTAURANTE-LOCAL-.git C:\dev\restaurante
cd C:\dev\restaurante
installer\build.cmd la-carreta
```

**Linux:**

```bash
./installer/build.sh la-carreta
```

Resultado en `installer/dist/`:

- `ValetecPOS-Setup-<versión>-la-carreta.exe`: el instalador
- `CREDENCIALES-la-carreta.txt`: usuarios y PINs iniciales

Sin nombre de cliente (`installer\build.cmd`) se genera el instalador genérico de Valetec, con administrador y PIN `1234`.

> En Windows conviene clonar en una ruta corta (ej. `C:\dev\restaurante`) para evitar el límite de longitud de rutas de `node_modules`.

## PINs

Los PINs se generan al azar la primera vez y se guardan en `installer/clientes/<cliente>/pins.local.json`, que **no se sube a GitHub**. Cada computadora que compile generará sus propios PINs.

Para que todos generen el instalador con **los mismos PINs**, pasen ese archivo por un medio privado (no por el repositorio) y cópienlo en la misma ruta antes de compilar. Para regenerar los PINs, bórrenlo.

## Agregar un cliente nuevo

Crear `installer/clientes/<cliente>/` con:

- `cliente.json`: datos de la empresa y usuarios (copiar el de `la-carreta` como plantilla)
- `logo.png`: logo cuadrado con fondo transparente (recomendado 512×512)
- `icon.ico`: icono del instalador (opcional; si falta se usa el de Valetec)
