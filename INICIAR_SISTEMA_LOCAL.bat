@echo off
setlocal EnableExtensions EnableDelayedExpansion
title VALETEC - Restaurante Local (100% Offline POS)
color 0A

cd /d "%~dp0"

:: ---------------------------------------------------------------------------
:: OBTENER LA IP LOCAL DE LA COMPUTADORA
:: ---------------------------------------------------------------------------
set "LOCAL_IP=localhost"
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4" /c:"Direccin IPv4"') do (
    set "temp_ip=%%a"
    set "temp_ip=!temp_ip: =!"
    if not "!temp_ip!"=="" (
        if not "!temp_ip:~0,3!"=="127" (
            set "LOCAL_IP=!temp_ip!"
            goto IP_ENCONTRADA
        )
    )
)
:IP_ENCONTRADA

cls
echo ==============================================================================
echo              VALETEC - SISTEMA GASTRONOMICO 100%% LOCAL / OFFLINE
echo ==============================================================================
echo.
echo  [1/3] Verificando Docker Desktop...
docker info >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo  [!] ADVERTENCIA: Docker no parece estar en ejecucion.
    echo      Por favor inicia Docker Desktop y vuelve a intentar.
    echo.
    pause
    exit /b 1
)

echo  [2/3] Levantando Base de Datos (PostgreSQL), Backend y Frontend...
docker compose up -d

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo  [!] Error al iniciar los contenedores.
    pause
    exit /b 1
)

echo.
echo  [3/3] Esperando que los servicios esten listos...
timeout /t 5 /nobreak >nul

cls
echo ==============================================================================
echo                  SISTEMA RESTAURANTE LOCAL INICIADO CON EXITO
echo ==============================================================================
echo.
echo   * PC Servidor / Caja Principal :  http://localhost:5188
echo   * Celulares Mozos / Tablets    :  http://!LOCAL_IP!:5188
echo.
echo   * Backend API                  :  http://localhost:3010
echo   * Base de Datos PostgreSQL     :  Puerto 5445 (restaurante_local)
echo.
echo ------------------------------------------------------------------------------
echo   ACCESOS POR DEFECTO:
echo   - PIN Administrador : 1234
echo   - Modo Operativo    : 100%% Local / Red LAN / Cero dependencias de nube
echo ==============================================================================
echo.
echo   [1] Abrir el sistema en el navegador ahora
echo   [2] Inicializar Base de Datos Limpia (Seed: 12 mesas y Admin 1234)
echo   [3] Ver logs en tiempo real
echo   [4] Detener el sistema
echo   [5] Salir
echo.
set "opt=1"
set /p "opt= Selecciona una opcion [1-5] (Enter para abrir navegador): "

if "%opt%"=="1" (
    start http://localhost:5188
    exit /b 0
)
if "%opt%"=="2" (
    echo Inicializando base de datos limpia...
    docker exec restaurante-local-backend-1 npm run db:setup
    docker exec restaurante-local-backend-1 npm run db:seed:clean
    echo Listo. Presiona una tecla para continuar...
    pause >nul
    start http://localhost:5188
    exit /b 0
)
if "%opt%"=="3" (
    docker compose logs -f
    exit /b 0
)
if "%opt%"=="4" (
    echo Deteniendo contenedores...
    docker compose down
    exit /b 0
)
if "%opt%"=="5" (
    exit /b 0
)

start http://localhost:5188
exit /b 0
