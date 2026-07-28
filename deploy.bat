@echo off
setlocal EnableExtensions

REM Tokyo Ramen Guide deployment helper.
REM GitHub integration on Vercel deploys main automatically.
cd /d "%~dp0"

echo [1/5] Running tests...
set "FAILED_STEP=npm run test"
call npm run test
if errorlevel 1 goto :failed

echo [2/5] Running typecheck...
set "FAILED_STEP=npm run typecheck"
call npm run typecheck
if errorlevel 1 goto :failed

echo [3/5] Running lint...
set "FAILED_STEP=npm run lint"
call npm run lint
if errorlevel 1 goto :failed

echo [4/5] Running production build...
set "FAILED_STEP=npm run build"
call npm run build
if errorlevel 1 goto :failed

for /f "delims=" %%B in ('git branch --show-current') do set "BRANCH=%%B"
if "%BRANCH%"=="" (
  echo Could not determine the current Git branch.
  exit /b 1
)

set "COMMIT_MESSAGE=%~1"
if "%COMMIT_MESSAGE%"=="" set /p "COMMIT_MESSAGE=Commit message (Enter for Deploy changes): "
if "%COMMIT_MESSAGE%"=="" set "COMMIT_MESSAGE=Deploy changes"

echo [5/5] Committing and pushing %BRANCH%...
set "FAILED_STEP=git commit / git push"
git add -A
REM Never stage the local .env file, even if it is tracked in an old checkout.
git reset -- .env >nul 2>&1
git diff --cached --quiet
if not errorlevel 1 (
  echo No staged changes. Skipping commit.
) else (
  git commit -m "%COMMIT_MESSAGE%"
  if errorlevel 1 goto :failed
)

git push --set-upstream origin "%BRANCH%"
if errorlevel 1 goto :failed

if /I "%BRANCH%"=="main" (
  echo Production deployment triggered by the push to main.
) else (
  echo Preview deployment triggered for %BRANCH%.
  echo Merge this branch into main to deploy to production.
)
echo.
pause
exit /b 0

:failed
echo.
echo Deployment stopped because this command failed:
echo %FAILED_STEP%
echo.
pause
exit /b 1
