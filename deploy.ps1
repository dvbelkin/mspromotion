[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Host,

    [Parameter(Mandatory = $true)]
    [string]$User,

    [Parameter(Mandatory = $true)]
    [string]$TargetDir,

    [int]$Port = 22,
    [string]$SshKeyPath = "",
    [string]$BuildCommand = "npm run build",
    [string]$ArtifactDir = "dist",
    [int]$KeepReleases = 5,
    [string]$RemotePostCommand = "",
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
    tar -czf $localArchive -C $artifactPath .
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to create archive"
    }
}
finally {
    Pop-Location
}

$sshArgs = @("-p", "$Port")
$scpArgs = @("-P", "$Port")
if (-not [string]::IsNullOrWhiteSpace($SshKeyPath)) {
    $sshArgs += @("-i", $SshKeyPath)
    $scpArgs += @("-i", $SshKeyPath)
}

$remote = "$User@$Host"

Write-Host "Uploading archive to ${remote}:$remoteArchive"
& scp @scpArgs $localArchive "$remote`:$remoteArchive"
if ($LASTEXITCODE -ne 0) {
    throw "Upload failed"
}

$targetDirQ = Quote-Sh -Value $TargetDir
$remoteArchiveQ = Quote-Sh -Value $remoteArchive
$releaseQ = Quote-Sh -Value $release
$postCommandBlock = if ([string]::IsNullOrWhiteSpace($RemotePostCommand)) { ":" } else { $RemotePostCommand }

$remoteScript = @"
set -euo pipefail

TARGET_DIR=$targetDirQ
REMOTE_ARCHIVE=$remoteArchiveQ
RELEASE=$releaseQ
KEEP_RELEASES=$KeepReleases

RELEASES_DIR=`$TARGET_DIR/releases
CURRENT_LINK=`$TARGET_DIR/current
RELEASE_DIR=`$RELEASES_DIR/`$RELEASE

mkdir -p "`$RELEASES_DIR" "`$RELEASE_DIR"
tar -xzf "`$REMOTE_ARCHIVE" -C "`$RELEASE_DIR"
ln -sfn "`$RELEASE_DIR" "`$CURRENT_LINK"

$postCommandBlock

rm -f "`$REMOTE_ARCHIVE"

old_releases=`$(ls -1dt "`$RELEASES_DIR"/* 2>/dev/null | tail -n +`$((KEEP_RELEASES + 1)) || true)
if [ -n "`$old_releases" ]; then
  echo "`$old_releases" | xargs -r rm -rf
fi
"@

Write-Host "Deploying release $release on server"
$remoteScript | & ssh @sshArgs $remote "bash -s"
if ($LASTEXITCODE -ne 0) {
    throw "Remote deploy script failed"
}

if (Test-Path -LiteralPath $localArchive) {
    Remove-Item -LiteralPath $localArchive -Force
}

Write-Host "Done. Active release: $TargetDir/current"
