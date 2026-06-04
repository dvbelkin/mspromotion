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
    [string]$ArtifactDir = ".",
    [int]$KeepReleases = 5,
    [string]$RemotePostCommand = "",
    [string]$AdminUser = "admin",
    [string]$AdminPassword = "suprun3456",
    [int]$AdminPort = 8787,
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

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $scriptDir) {
    $scriptDir = (Get-Location).Path
}

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
$adminUserQ = Quote-Sh -Value $AdminUser
$adminPasswordQ = Quote-Sh -Value $AdminPassword
$adminPortQ = Quote-Sh -Value $AdminPort
$postCommandBlock = if ([string]::IsNullOrWhiteSpace($RemotePostCommand)) { ":" } else { $RemotePostCommand }

$remoteScript = @"
set -euo pipefail

TARGET_DIR=$targetDirQ
REMOTE_ARCHIVE=$remoteArchiveQ
RELEASE=$releaseQ
KEEP_RELEASES=$KeepReleases
ADMIN_USER=$adminUserQ
ADMIN_PASSWORD=$adminPasswordQ
ADMIN_PORT=$adminPortQ

RELEASES_DIR=`$TARGET_DIR/releases
CURRENT_LINK=`$TARGET_DIR/current
RELEASE_DIR=`$RELEASES_DIR/`$RELEASE
SHARED_DIR=`$TARGET_DIR/shared

mkdir -p "`$RELEASES_DIR" "`$RELEASE_DIR" "`$SHARED_DIR"
tar -xzf "`$REMOTE_ARCHIVE" -C "`$RELEASE_DIR"

mkdir -p "`$RELEASE_DIR/src/content" "`$RELEASE_DIR/public"

has_files() {
  [ -d "`$1" ] && find "`$1" -mindepth 1 -print -quit | grep -q .
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

for shared_path in src/content/events src/content/pages src/content/projects src/content/promos public/uploads; do
  seed_shared_dir "`$CURRENT_LINK/`$shared_path" "`$SHARED_DIR/`$shared_path"
  seed_shared_dir "`$RELEASE_DIR/`$shared_path" "`$SHARED_DIR/`$shared_path"
  link_shared_dir "`$SHARED_DIR/`$shared_path" "`$RELEASE_DIR/`$shared_path"
done

ln -sfn "`$RELEASE_DIR" "`$CURRENT_LINK"

cd "`$CURRENT_LINK"
npm ci --include=dev
pkill -f "scripts/admin-server.mjs" || true
nohup env ADMIN_USER="`$ADMIN_USER" ADMIN_PASSWORD="`$ADMIN_PASSWORD" ADMIN_PORT="`$ADMIN_PORT" npm run admin >/tmp/mspromotion-admin.log 2>&1 &

for attempt in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS "http://127.0.0.1:`$ADMIN_PORT/health" >/dev/null; then
    break
  fi

  if [ "`$attempt" -eq 10 ]; then
    echo "Admin backend failed to start on port `$ADMIN_PORT"
    tail -n 100 /tmp/mspromotion-admin.log || true
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
$autoNeedsTty = -not [string]::IsNullOrWhiteSpace($RemotePostCommand) -and ($RemotePostCommand -match '(^|\s)sudo(\s|$)')
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
