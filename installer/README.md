# Generar el instalador (.exe)

El instalador para Windows se compila desde **Linux**.

## Requisitos

- Node.js 20 o superior, npm y `unzip`
- `makensis` instalado, o Docker (si no hay NSIS, se compila dentro de un contenedor)

La primera vez descarga ~360 MB (Node, PostgreSQL, Visual C++, WinSW) y los guarda en `installer/cache/`. Las siguientes compilaciones son más rápidas.

## Compilar

```bash
./installer/build.sh la-carreta
```

Resultado en `installer/dist/`:

- `ValetecPOS-Setup-<versión>-la-carreta.exe`: el instalador
- `CREDENCIALES-la-carreta.txt`: usuarios y PINs iniciales

Sin nombre de cliente (`./installer/build.sh`) se genera el instalador genérico de Valetec, con administrador y PIN `1234`.

## PINs

Los PINs se generan al azar la primera vez y se guardan en `installer/clientes/<cliente>/pins.local.json`, que **no se sube a GitHub**. Se reutilizan en cada compilación; para regenerarlos, borra ese archivo.

## Agregar un cliente nuevo

Crear `installer/clientes/<cliente>/` con:

- `cliente.json`: datos de la empresa y usuarios (copiar el de `la-carreta` como plantilla)
- `logo.png`: logo cuadrado con fondo transparente (recomendado 512×512)
- `icon.ico`: icono del instalador (opcional; si falta se usa el de Valetec)
