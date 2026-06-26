[CmdletBinding()]
param(
    [Alias("Host")]
    [string]$Server = "192.168.1.6",

    [string]$User = "tahradm",

    [string]$TargetDir = "/var/www/mspromotion",

    [int]$Port = 2222,
    [string]$SshKeyPath = "",
    [string]$SshConfigPath = "",
    [switch]$IgnoreLocalSshConfig,
    [string]$BuildCommand = "npm run build",
    [string]$RemoteBuildCommand = "npm run build",
    [string]$ArtifactDir = ".",
    [int]$KeepReleases = 5,
    [string]$RemotePostCommand = "",
    [string]$AdminUser = "",
    [string]$AdminPassword = "",
    [int]$AdminPort = 8787,
    [string]$AdminBuildCommand = "npm run build",
    [ValidateSet("pm2", "nohup")]
    [string]$ProcessManager = "pm2",
    [string]$Pm2AppName = "mspromotion-admin",
    [switch]$SkipSharedBackup,
    [switch]$AllocateTty,
    [switch]$SkipBuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Require-Command {
    param([Parameter(Mandatory = $true)][string]$Name)

    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required command not found: $Name"
    }
}

function Quote-Sh {
    param([Parameter(Mandatory = $true)][string]$Value)

    return "'" + $Value.Replace("'", "'""'""'") + "'"
}

function Read-DotEnvFile {
    param([Parameter(Mandatory = $true)][string]$Path)

    $result = @{}
    if (-not (Test-Path -LiteralPath $Path)) {
        return $result
    }

    foreach ($line in Get-Content -LiteralPath $Path) {
        $trimmed = $line.Trim()
        if (-not $trimmed -or $trimmed.StartsWith("#")) {
            continue
        }

        $separatorIndex = $trimmed.IndexOf("=")
        if ($separatorIndex -lt 1) {
            continue
        }

        $key = $trimmed.Substring(0, $separatorIndex).Trim()
        $value = $trimmed.Substring($separatorIndex + 1).Trim()

        if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
            $value = $value.Substring(1, $value.Length - 2)
        }

        $result[$key] = $value
    }

    return $result
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $scriptDir) {
    $scriptDir = (Get-Location).Path
}

$dotenvPath = Join-Path $scriptDir ".env"
$dotenv = Read-DotEnvFile -Path $dotenvPath

Require-Command -Name "ssh"
Require-Command -Name "scp"
Require-Command -Name "tar"
if (-not $SkipBuild) {
    Require-Command -Name "npm"
}

if ($KeepReleases -lt 1) {
    throw "KeepReleases must be >= 1"
}

if (-not [string]::IsNullOrWhiteSpace($SshKeyPath) -and -not (Test-Path -LiteralPath $SshKeyPath)) {
    throw "SSH key does not exist: $SshKeyPath"
}

$resolvedAdminUser = if (-not [string]::IsNullOrWhiteSpace($AdminUser)) {
    $AdminUser
} elseif ($dotenv.ContainsKey("ADMIN_USER") -and -not [string]::IsNullOrWhiteSpace($dotenv["ADMIN_USER"])) {
    $dotenv["ADMIN_USER"]
} elseif (-not [string]::IsNullOrWhiteSpace($env:MSPROMOTION_ADMIN_USER)) {
    $env:MSPROMOTION_ADMIN_USER
} elseif (-not [string]::IsNullOrWhiteSpace($env:ADMIN_USER)) {
    $env:ADMIN_USER
} else {
    "admin"
}

$resolvedAdminPassword = if (-not [string]::IsNullOrWhiteSpace($AdminPassword)) {
    $AdminPassword
} elseif ($dotenv.ContainsKey("ADMIN_PASSWORD") -and -not [string]::IsNullOrWhiteSpace($dotenv["ADMIN_PASSWORD"])) {
    $dotenv["ADMIN_PASSWORD"]
} elseif (-not [string]::IsNullOrWhiteSpace($env:MSPROMOTION_ADMIN_PASSWORD)) {
    $env:MSPROMOTION_ADMIN_PASSWORD
} elseif (-not [string]::IsNullOrWhiteSpace($env:ADMIN_PASSWORD)) {
    $env:ADMIN_PASSWORD
} else {
    ""
}

if ([string]::IsNullOrWhiteSpace($resolvedAdminPassword)) {
    throw "AdminPassword is required. Set it in .env, pass -AdminPassword, or set MSPROMOTION_ADMIN_PASSWORD."
}

if ($dotenv.ContainsKey("ADMIN_PORT") -and -not $PSBoundParameters.ContainsKey("AdminPort")) {
    $dotenvAdminPort = 0
    if ([int]::TryParse($dotenv["ADMIN_PORT"], [ref]$dotenvAdminPort)) {
        $AdminPort = $dotenvAdminPort
    }
}

if ($dotenv.ContainsKey("ADMIN_BUILD_COMMAND") -and -not $PSBoundParameters.ContainsKey("AdminBuildCommand") -and -not [string]::IsNullOrWhiteSpace($dotenv["ADMIN_BUILD_COMMAND"])) {
    $AdminBuildCommand = $dotenv["ADMIN_BUILD_COMMAND"]
}

$release = Get-Date -Format "yyyyMMdd-HHmmss"
$archiveName = "deploy-$release.tar.gz"
$localArchive = Join-Path $env:TEMP $archiveName
$remoteArchive = "/tmp/$archiveName"

Push-Location $scriptDir
try {
    if (-not $SkipBuild) {
        Write-Host "Building project: $BuildCommand"
        cmd /c $BuildCommand
        if ($LASTEXITCODE -ne 0) {
            throw "Build failed with exit code $LASTEXITCODE"
        }
    }

    $artifactPath = Join-Path $scriptDir $ArtifactDir
    if (-not (Test-Path -LiteralPath $artifactPath)) {
        throw "Artifact directory not found: $artifactPath"
    }

    if (Test-Path -LiteralPath $localArchive) {
        Remove-Item -LiteralPath $localArchive -Force
    }

    Write-Host "Packing artifact: $artifactPath"
    tar -czf $localArchive `
        --exclude=node_modules `
        --exclude=.git `
        --exclude=.astro `
        --exclude=dist `
        --exclude=src/content/events `
        --exclude=src/content/pages `
        --exclude=src/content/projects `
        --exclude=src/content/promos `
        --exclude=public/uploads `
        -C $artifactPath .
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to create archive"
    }
}
finally {
    Pop-Location
}

$sshArgs = @("-p", "$Port")
$scpArgs = @("-P", "$Port")

if ($IgnoreLocalSshConfig) {
    $SshConfigPath = "NUL"
}

if (-not [string]::IsNullOrWhiteSpace($SshConfigPath)) {
    $sshArgs += @("-F", $SshConfigPath)
    $scpArgs += @("-F", $SshConfigPath)
}

if (-not [string]::IsNullOrWhiteSpace($SshKeyPath)) {
    $sshArgs += @("-i", $SshKeyPath)
    $scpArgs += @("-i", $SshKeyPath)
}

$remote = "$User@$Server"

Write-Host "Uploading archive to ${remote}:$remoteArchive"
& scp @scpArgs $localArchive "$remote`:$remoteArchive"
if ($LASTEXITCODE -ne 0) {
    throw "Upload failed"
}

$targetDirQ = Quote-Sh -Value $TargetDir
$remoteArchiveQ = Quote-Sh -Value $remoteArchive
$releaseQ = Quote-Sh -Value $release
$adminUserQ = Quote-Sh -Value $resolvedAdminUser
$adminPasswordQ = Quote-Sh -Value $resolvedAdminPassword
$adminPortQ = Quote-Sh -Value $AdminPort
$adminBuildCommandQ = Quote-Sh -Value $AdminBuildCommand
$remoteBuildCommandQ = Quote-Sh -Value $RemoteBuildCommand
$processManagerQ = Quote-Sh -Value $ProcessManager
$pm2AppNameQ = Quote-Sh -Value $Pm2AppName
$postCommandBlock = if ([string]::IsNullOrWhiteSpace($RemotePostCommand)) { ":" } else { $RemotePostCommand }
$skipSharedBackupFlag = if ($SkipSharedBackup) { 1 } else { 0 }

$remoteScript = @"
set -euo pipefail

TARGET_DIR=$targetDirQ
REMOTE_ARCHIVE=$remoteArchiveQ
RELEASE=$releaseQ
KEEP_RELEASES=$KeepReleases
ADMIN_USER=$adminUserQ
ADMIN_PASSWORD=$adminPasswordQ
ADMIN_PORT=$adminPortQ
ADMIN_BUILD_COMMAND=$adminBuildCommandQ
REMOTE_BUILD_COMMAND=$remoteBuildCommandQ
PROCESS_MANAGER=$processManagerQ
PM2_APP_NAME=$pm2AppNameQ
SKIP_SHARED_BACKUP=$skipSharedBackupFlag

RELEASES_DIR=`$TARGET_DIR/releases
CURRENT_LINK=`$TARGET_DIR/current
RELEASE_DIR=`$RELEASES_DIR/`$RELEASE
SHARED_DIR=`$TARGET_DIR/shared
BACKUPS_DIR=`$TARGET_DIR/backups

mkdir -p "`$RELEASES_DIR" "`$RELEASE_DIR" "`$SHARED_DIR"
tar -xzf "`$REMOTE_ARCHIVE" -C "`$RELEASE_DIR"

mkdir -p "`$RELEASE_DIR/src/content" "`$RELEASE_DIR/public"

has_files() {
  [ -d "`$1" ] && find "`$1" -mindepth 1 -print -quit | grep -q .
}

has_markdown_files() {
  [ -d "`$1" ] && find "`$1" -type f \( -name '*.md' -o -name '*.mdx' \) -print -quit | grep -q .
}

seed_shared_dir() {
  local source_dir="`$1"
  local shared_dir="`$2"

  if has_files "`$shared_dir"; then
    return 0
  fi

  mkdir -p "`$shared_dir"

  if has_files "`$source_dir"; then
    cp -a "`$source_dir"/. "`$shared_dir"/
  fi
}

link_shared_dir() {
  local shared_dir="`$1"
  local link_dir="`$2"

  rm -rf "`$link_dir"
  mkdir -p "`$(dirname "`$link_dir")"
  ln -s "`$shared_dir" "`$link_dir"
}

assert_shared_ready() {
  if ! has_markdown_files "`$SHARED_DIR/src/content"; then
    echo "shared/src/content is empty. Restore content backup or initialize shared before deploy." >&2
    exit 1
  fi

  if ! has_files "`$SHARED_DIR/public/uploads"; then
    echo "shared/public/uploads is empty. Restore media backup or initialize shared before deploy." >&2
    exit 1
  fi
}

backup_shared() {
  local backup_name="shared-`$RELEASE.tar.gz"
  mkdir -p "`$BACKUPS_DIR"
  tar -czf "`$BACKUPS_DIR/`$backup_name" -C "`$SHARED_DIR" src/content public/uploads
}

start_admin_backend() {
  if [ "`$PROCESS_MANAGER" = "pm2" ]; then
    if ! command -v pm2 >/dev/null 2>&1; then
      echo "pm2 is unavailable on the server. Use -ProcessManager nohup or install pm2." >&2
      exit 1
    fi

    if pm2 describe "`$PM2_APP_NAME" >/dev/null 2>&1; then
      pm2 delete "`$PM2_APP_NAME"
    fi

    env ADMIN_USER="`$ADMIN_USER" ADMIN_PASSWORD="`$ADMIN_PASSWORD" ADMIN_PORT="`$ADMIN_PORT" ADMIN_BUILD_COMMAND="`$ADMIN_BUILD_COMMAND" \
      pm2 start npm --name "`$PM2_APP_NAME" --cwd "`$CURRENT_LINK" -- run admin

    pm2 save
    return 0
  fi

  pkill -f "scripts/admin-server.mjs" || true
  nohup env ADMIN_USER="`$ADMIN_USER" ADMIN_PASSWORD="`$ADMIN_PASSWORD" ADMIN_PORT="`$ADMIN_PORT" ADMIN_BUILD_COMMAND="`$ADMIN_BUILD_COMMAND" npm run admin >/tmp/mspromotion-admin.log 2>&1 &
}

prune_old_releases() {
  if [ "`$KEEP_RELEASES" -lt 1 ]; then
    return 0
  fi

  find "`$RELEASES_DIR" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort -r | tail -n +`$((`$KEEP_RELEASES + 1)) | while read -r old_release; do
    [ -n "`$old_release" ] || continue
    rm -rf "`$RELEASES_DIR/`$old_release"
  done
}

for shared_path in src/content/events src/content/pages src/content/projects src/content/promos public/uploads; do
  seed_shared_dir "`$CURRENT_LINK/`$shared_path" "`$SHARED_DIR/`$shared_path"
  seed_shared_dir "`$RELEASE_DIR/`$shared_path" "`$SHARED_DIR/`$shared_path"
  link_shared_dir "`$SHARED_DIR/`$shared_path" "`$RELEASE_DIR/`$shared_path"
done

assert_shared_ready

if [ "`$SKIP_SHARED_BACKUP" -ne 1 ]; then
  backup_shared
fi

ln -sfn "`$RELEASE_DIR" "`$CURRENT_LINK"

cd "`$CURRENT_LINK"
npm ci --include=dev
bash -lc "`$REMOTE_BUILD_COMMAND"

if [ ! -d "`$CURRENT_LINK/dist" ]; then
  echo "Remote build did not produce dist/." >&2
  exit 1
fi

if [ ! -L "`$CURRENT_LINK/src/content/events" ] || [ ! -L "`$CURRENT_LINK/public/uploads" ]; then
  echo "Shared paths were not linked into the active release." >&2
  exit 1
fi

start_admin_backend
prune_old_releases

for attempt in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS "http://127.0.0.1:`$ADMIN_PORT/health" >/dev/null; then
    break
  fi

  if [ "`$attempt" -eq 10 ]; then
    echo "Admin backend failed to start on port `$ADMIN_PORT"
    if [ "`$PROCESS_MANAGER" = "pm2" ]; then
      pm2 status "`$PM2_APP_NAME" || true
      pm2 logs "`$PM2_APP_NAME" --lines 100 --nostream || true
    else
      tail -n 100 /tmp/mspromotion-admin.log || true
    fi
    exit 1
  fi

  sleep 2
done

$postCommandBlock

rm -f "`$REMOTE_ARCHIVE"
"@
$remoteScript = $remoteScript -replace "`r`n", "`n"

Write-Host "Deploying release $release on server"
$sshDeployArgs = @($sshArgs)
$autoNeedsTty = $false
if ($AllocateTty -or $autoNeedsTty) {
    $sshDeployArgs += "-tt"
}

$remoteScript | & ssh @sshDeployArgs $remote "bash -s"
if ($LASTEXITCODE -ne 0) {
    throw "Remote deploy script failed"
}

if (Test-Path -LiteralPath $localArchive) {
    Remove-Item -LiteralPath $localArchive -Force
}

Write-Host "Done. Active release: $TargetDir/current"
