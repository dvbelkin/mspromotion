Get-ChildItem .\public\uploads -Recurse -File -Include *.jpg,*.jpeg | ForEach-Object {
  $tmp = Join-Path $_.DirectoryName ($_.BaseName + ".opt.jpg")
  ffmpeg -y -i $_.FullName -vf "scale='if(gt(iw,1000),1000,iw)':-2" -q:v 4 $tmp
  Move-Item -Force $tmp $_.FullName
}