@echo off
:: NeuroLexia — Start PostgreSQL (portable embedded instance)
:: Run this once before "npm run dev" if PostgreSQL is not already running.

set PG_BIN=%LOCALAPPDATA%\pg-embedded\node_modules\@embedded-postgres\windows-x64\native\bin
set PG_DATA=%LOCALAPPDATA%\pgdata-neurolexia
set PG_LOG=%PG_DATA%\pg.log

echo Checking PostgreSQL status...
"%PG_BIN%\pg_ctl.exe" -D "%PG_DATA%" status 2>nul
if %errorlevel% == 0 (
  echo PostgreSQL is already running.
) else (
  echo Starting PostgreSQL...
  "%PG_BIN%\pg_ctl.exe" -D "%PG_DATA%" -l "%PG_LOG%" start
  timeout /t 3 /nobreak >nul
  echo PostgreSQL started.
)
echo.
echo Connection string: postgresql://postgres@127.0.0.1:5432/neurolexia
echo.
echo You can now run:  npm run dev
