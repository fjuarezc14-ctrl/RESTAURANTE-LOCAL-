; ============================================================
; INSTALADOR WINDOWS - VALETEC POS
; Se compila con installer/build.sh (no ejecutar makensis a mano).
; Variables requeridas: STAGE, OUTFILE, VERSION
; ============================================================
Unicode true
!include "MUI2.nsh"
!include "x64.nsh"
!include "LogicLib.nsh"

!define APPNAME "Valetec POS"
!define APP_URL "http://localhost:5188"
!define REGKEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\ValetecPOS"

Name "${APPNAME}"
OutFile "${OUTFILE}"
InstallDir "C:\ValetecPOS"
RequestExecutionLevel admin
SetCompressor /SOLID lzma
ShowInstDetails show
BrandingText "${APPNAME} ${VERSION}"

!define MUI_ICON "${STAGE}/setup/icon.ico"
!define MUI_UNICON "${STAGE}/setup/icon.ico"
!define MUI_ABORTWARNING

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_RUN
!define MUI_FINISHPAGE_RUN_TEXT "Abrir ${APPNAME}"
!define MUI_FINISHPAGE_RUN_FUNCTION OpenApp
!define MUI_FINISHPAGE_SHOWREADME "$INSTDIR\ACCESO.txt"
!define MUI_FINISHPAGE_SHOWREADME_TEXT "Ver direcciones para los celulares de los mozos"
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "Spanish"

Function .onInit
  ${IfNot} ${RunningX64}
    MessageBox MB_ICONSTOP "${APPNAME} requiere Windows de 64 bits."
    Abort
  ${EndIf}
  SetRegView 64
FunctionEnd

Function un.onInit
  SetRegView 64
FunctionEnd

Function OpenApp
  ExecShell "open" "${APP_URL}"
FunctionEnd

Section "Instalar"
  SetShellVarContext all

  ; Detener servicios de una versión anterior para poder reemplazar archivos (la carpeta data se conserva)
  nsExec::ExecToLog 'sc.exe stop ValetecPOS-App'
  nsExec::ExecToLog 'sc.exe stop ValetecPOS-DB'
  Sleep 4000
  RMDir /r "$INSTDIR\app\dist"
  RMDir /r "$INSTDIR\app\backend\node_modules"

  SetOutPath "$INSTDIR"
  File /r "${STAGE}/*"
  WriteUninstaller "$INSTDIR\Desinstalar.exe"

  ; Runtime de Visual C++ requerido por PostgreSQL (0 = ok, 1638 = ya hay una versión igual o más nueva, 3010 = requiere reinicio)
  DetailPrint "Instalando runtime de Visual C++..."
  ExecWait '"$INSTDIR\setup\vc_redist.x64.exe" /install /quiet /norestart' $1
  ${If} $1 != 0
  ${AndIf} $1 != 1638
  ${AndIf} $1 != 3010
    MessageBox MB_ICONSTOP "No se pudo instalar el runtime de Visual C++ (código $1)."
    Abort
  ${EndIf}

  DetailPrint "Configurando base de datos y servicios (puede tardar unos minutos)..."
  nsExec::ExecToLog '"$INSTDIR\node\node.exe" "$INSTDIR\setup\setup.js"'
  Pop $0
  ${If} $0 != 0
    MessageBox MB_ICONSTOP "La configuración falló (código $0).$\r$\nRevisa el archivo:$\r$\n$INSTDIR\logs\instalacion.log"
    Abort
  ${EndIf}

  ; Accesos directos (abren el sistema en el navegador)
  WriteINIStr "$DESKTOP\${APPNAME}.url" "InternetShortcut" "URL" "${APP_URL}"
  WriteINIStr "$DESKTOP\${APPNAME}.url" "InternetShortcut" "IconFile" "$INSTDIR\setup\icon.ico"
  WriteINIStr "$DESKTOP\${APPNAME}.url" "InternetShortcut" "IconIndex" "0"
  CreateDirectory "$SMPROGRAMS\${APPNAME}"
  CopyFiles /SILENT "$DESKTOP\${APPNAME}.url" "$SMPROGRAMS\${APPNAME}\${APPNAME}.url"
  CreateShortcut "$SMPROGRAMS\${APPNAME}\Direcciones de acceso.lnk" "$INSTDIR\ACCESO.txt"
  CreateShortcut "$SMPROGRAMS\${APPNAME}\Desinstalar.lnk" "$INSTDIR\Desinstalar.exe"

  ; Registro en "Agregar o quitar programas"
  WriteRegStr HKLM "${REGKEY}" "DisplayName" "${APPNAME}"
  WriteRegStr HKLM "${REGKEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKLM "${REGKEY}" "Publisher" "VT VALETEC"
  WriteRegStr HKLM "${REGKEY}" "DisplayIcon" "$INSTDIR\setup\icon.ico"
  WriteRegStr HKLM "${REGKEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKLM "${REGKEY}" "UninstallString" '"$INSTDIR\Desinstalar.exe"'
  WriteRegDWORD HKLM "${REGKEY}" "NoModify" 1
  WriteRegDWORD HKLM "${REGKEY}" "NoRepair" 1
SectionEnd

Section "Uninstall"
  SetShellVarContext all

  nsExec::ExecToLog '"$INSTDIR\node\node.exe" "$INSTDIR\setup\uninstall.js"'
  Sleep 3000

  Delete "$DESKTOP\${APPNAME}.url"
  RMDir /r "$SMPROGRAMS\${APPNAME}"

  RMDir /r "$INSTDIR\app"
  RMDir /r "$INSTDIR\node"
  RMDir /r "$INSTDIR\pgsql"
  RMDir /r "$INSTDIR\setup"
  RMDir /r "$INSTDIR\logs"
  Delete "$INSTDIR\ACCESO.txt"
  Delete "$INSTDIR\Desinstalar.exe"

  MessageBox MB_YESNO|MB_ICONEXCLAMATION|MB_DEFBUTTON2 "¿Eliminar también la base de datos con TODAS las ventas?$\r$\nEsta acción no se puede deshacer." /SD IDNO IDNO keep_data
    RMDir /r "$INSTDIR\data"
  keep_data:

  RMDir "$INSTDIR"
  DeleteRegKey HKLM "${REGKEY}"
SectionEnd
