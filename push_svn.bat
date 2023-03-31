@SET TORTOISE_PATH=%ProgramW6432%\TortoiseSVN\bin\TortoiseProc.exe

git archive HEAD --output=../dcjam2023.tar
rd /s /q ..\dcjam2023svn\src
rd /s /q ..\dcjam2023svn\build
@pushd ..\dcjam2023svn
tar xf ../dcjam2023.tar
del ..\dcjam2023.tar
call npm i --no-audit --no-fund
@popd
@for /F usebackq %%a in (`git rev-parse HEAD`) do SET VER=%%a
"%TORTOISE_PATH%" /command:commit /path:..\dcjam2023svn\  /logmsg:"Update from git %VER%"
