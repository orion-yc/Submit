@echo off
setlocal

set "PROJECT_DIR=%~dp0"
set "BUILD_DIR=%PROJECT_DIR%backend\build"

where cmake >nul 2>&1
if errorlevel 1 goto :cmake_missing

echo [1/2] Configuring Submit C++ service...
cmake -S "%PROJECT_DIR%backend" -B "%BUILD_DIR%"
if errorlevel 1 goto :build_failed

echo [2/2] Building Release configuration...
cmake --build "%BUILD_DIR%" --config Release
if errorlevel 1 goto :build_failed

echo.
if exist "%BUILD_DIR%\Release\submit_service.exe" (
  echo Build complete: "%BUILD_DIR%\Release\submit_service.exe"
) else if exist "%BUILD_DIR%\submit_service.exe" (
  echo Build complete: "%BUILD_DIR%\submit_service.exe"
) else (
  echo Build completed. Check the build output above for the executable location.
)
echo.
pause
exit /b 0

:cmake_missing
echo CMake was not found. Install CMake and add it to PATH, then run this file again.
echo.
pause
exit /b 1

:build_failed
echo.
echo Build failed. Review the CMake or compiler errors above.
echo.
pause
exit /b 1
