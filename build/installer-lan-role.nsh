!macro customInstall
  StrCpy $0 "standalone"

  MessageBox MB_YESNOCANCEL|MB_ICONQUESTION "Configuracion inicial de red local (LAN):$\r$\n$\r$\nSi = Servidor LAN$\r$\nNo = Cliente LAN$\r$\nCancelar = Standalone (local)" IDYES role_server IDNO role_client

role_server:
  StrCpy $0 "server"
  StrCpy $2 "0.0.0.0"
  Goto write_config

role_client:
  StrCpy $0 "client"
  StrCpy $2 "auto"
  Goto write_config

role_standalone:
  StrCpy $0 "standalone"
  StrCpy $2 "127.0.0.1"

write_config:
  CreateDirectory "$APPDATA\Rectificadora App"
  FileOpen $1 "$APPDATA\Rectificadora App\installer-lan-config.txt" w
  FileWrite $1 "mode=$0$\r$\n"
  FileWrite $1 "host=$2$\r$\n"
  FileWrite $1 "port=4510$\r$\n"
  FileWrite $1 "token=$\r$\n"
  FileClose $1
!macroend
