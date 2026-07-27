!macro customCheckAppRunning
  FileOpen $0 "$TEMP\rectificadora-installer.log" a
  FileWrite $0 "[customCheckAppRunning] begin instdir=$INSTDIR exe=${APP_EXECUTABLE_FILENAME}$\r$\n"
  FileClose $0

  nsExec::Exec '"$PowerShellPath" -NoProfile -ExecutionPolicy Bypass -C "Get-CimInstance -ClassName Win32_Process | ? {$$_.Path -and $$_.Path.StartsWith(''$INSTDIR'', ''CurrentCultureIgnoreCase'')} | % { try { Stop-Process -Id $$_.ProcessId -Force -ErrorAction SilentlyContinue } catch {} }"'
  Pop $R0
  FileOpen $0 "$TEMP\rectificadora-installer.log" a
  FileWrite $0 "[customCheckAppRunning] powershell path-kill exit=$R0$\r$\n"
  FileClose $0

  ExecWait '"$CmdPath" /C taskkill /F /T /IM "${APP_EXECUTABLE_FILENAME}"' $R0
  FileOpen $0 "$TEMP\rectificadora-installer.log" a
  FileWrite $0 "[customCheckAppRunning] taskkill ${APP_EXECUTABLE_FILENAME} exit=$R0$\r$\n"
  FileClose $0

  ExecWait '"$CmdPath" /C taskkill /F /T /IM "Rectificadora App.exe"' $R0
  FileOpen $0 "$TEMP\rectificadora-installer.log" a
  FileWrite $0 "[customCheckAppRunning] taskkill Rectificadora App.exe exit=$R0$\r$\n"
  FileClose $0

  ExecWait '"$CmdPath" /C taskkill /F /T /IM "tailadmin-react.exe"' $R0
  FileOpen $0 "$TEMP\rectificadora-installer.log" a
  FileWrite $0 "[customCheckAppRunning] taskkill tailadmin-react.exe exit=$R0$\r$\n"
  FileClose $0

  ExecWait '"$CmdPath" /C taskkill /F /T /IM "crashpad_handler.exe"' $R0
  FileOpen $0 "$TEMP\rectificadora-installer.log" a
  FileWrite $0 "[customCheckAppRunning] taskkill crashpad_handler.exe exit=$R0$\r$\n"
  FileClose $0

  Sleep 1200
!macroend

!ifndef BUILD_UNINSTALLER
Var /GLOBAL InstallerDiagLog
Var /GLOBAL InstallerDiagLogFallback

!macro customInit
  StrCpy $InstallerDiagLog "$EXEDIR\rectificadora-installer.log"
  StrCpy $InstallerDiagLogFallback "$TEMP\rectificadora-installer.log"

  Delete "$InstallerDiagLog"
  Delete "$InstallerDiagLogFallback"

  FileOpen $0 "$InstallerDiagLog" w
  FileWrite $0 "[customInit] installer started$\r$\n"
  FileClose $0

  FileOpen $0 "$InstallerDiagLogFallback" w
  FileWrite $0 "[customInit] installer started$\r$\n"
  FileClose $0

  ExecWait '"$SYSDIR\taskkill.exe" /F /T /IM "Rectificadora App.exe"' $R0
  FileOpen $0 "$InstallerDiagLog" a
  FileWrite $0 "[customInit] taskkill Rectificadora App.exe exit=$R0$\r$\n"
  FileClose $0
  FileOpen $0 "$InstallerDiagLogFallback" a
  FileWrite $0 "[customInit] taskkill Rectificadora App.exe exit=$R0$\r$\n"
  FileClose $0

  ExecWait '"$SYSDIR\taskkill.exe" /F /T /IM "tailadmin-react.exe"' $R0
  FileOpen $0 "$InstallerDiagLog" a
  FileWrite $0 "[customInit] taskkill tailadmin-react.exe exit=$R0$\r$\n"
  FileClose $0
  FileOpen $0 "$InstallerDiagLogFallback" a
  FileWrite $0 "[customInit] taskkill tailadmin-react.exe exit=$R0$\r$\n"
  FileClose $0
!macroend

!macro customInstall
  StrCpy $0 "standalone"
  StrCpy $2 "127.0.0.1"

  MessageBox MB_YESNOCANCEL|MB_ICONQUESTION "Configuracion inicial de red local (LAN):$\r$\n$\r$\nSi = Servidor LAN$\r$\nNo = Cliente LAN$\r$\nCancelar = Standalone (local)" /SD IDCANCEL IDYES role_server IDNO role_client
  Goto write_config

role_server:
  StrCpy $0 "server"
  StrCpy $2 "0.0.0.0"
  Goto write_config

role_client:
  StrCpy $0 "client"
  StrCpy $2 "auto"
  Goto write_config

write_config:
  FileOpen $3 "$InstallerDiagLog" a
  FileWrite $3 "[customInstall] mode=$0 host=$2 port=4510$\r$\n"
  FileClose $3
  FileOpen $3 "$InstallerDiagLogFallback" a
  FileWrite $3 "[customInstall] mode=$0 host=$2 port=4510$\r$\n"
  FileClose $3

  CreateDirectory "$APPDATA\Rectificadora App"
  FileOpen $1 "$APPDATA\Rectificadora App\installer-lan-config.txt" w
  FileWrite $1 "mode=$0$\r$\n"
  FileWrite $1 "host=$2$\r$\n"
  FileWrite $1 "port=4510$\r$\n"
  FileWrite $1 "token=$\r$\n"
  FileClose $1
!macroend
!endif
