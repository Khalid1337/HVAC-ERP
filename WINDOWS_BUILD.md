# Windows Desktop Build

The desktop package uses Electron and stores each client's database in the Windows user profile. It does not include the current Linux `erp.db` file.

## Build on Kali Linux

Install Wine once as an administrator:

```bash
sudo apt update
sudo apt install -y wine64
```

Then, from the project root:

```bash
npm install
npm run build:windows
```

The installer is created at:

```text
release/HVAC ERP Setup 1.0.0.exe
```

Copy that installer to the Windows client and run it. The first build is unsigned, so Windows SmartScreen may show a warning. A code-signing certificate is required for a trusted production installer.

## Build on Windows

Install Node.js LTS, open PowerShell in the project folder, and run:

```powershell
npm install
npm run build:windows
```

The same installer is written to the `release` folder.

## Build from GitHub Actions

The repository includes a Windows workflow at `.github/workflows/windows-build.yml`. It runs automatically for pushes to `main` and can also be started manually from the Actions tab. Download the `hvac-erp-windows-installer` artifact from the completed workflow run.

## Client data and backups

Each installation uses its own data directory:

```text
%APPDATA%/HVAC ERP/erp.db
%APPDATA%/HVAC ERP/backups/
```

The app creates a startup backup and daily backups, retaining the newest 30 copies.