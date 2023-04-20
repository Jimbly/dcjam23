@SET TORTOISE_PATH=%ProgramW6432%\TortoiseSVN\bin\TortoiseProc.exe

call node build build

rd /s /q ..\..\SRC2\web\dashingstrike.com\LudumDare\DCJ2023
md ..\..\SRC2\web\dashingstrike.com\LudumDare\DCJ2023
xcopy /s dist\game\build.prod\client\ ..\..\SRC2\web\dashingstrike.com\LudumDare\DCJ2023\
@for /F usebackq %%a in (`git rev-parse HEAD`) do SET VER=%%a
"%TORTOISE_PATH%" /command:commit /path:..\..\SRC2\web\dashingstrike.com\LudumDare\DCJ2023  /logmsg:"Jam update from git %VER%"

@echo Now, deploy flightplan web-prod.