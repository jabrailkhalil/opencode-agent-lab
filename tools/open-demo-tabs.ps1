param([Parameter(Mandatory=$true)][string]$Urls)
$ErrorActionPreference='Stop'
$demoUrls=@($Urls.Split(','))
foreach($url in $demoUrls){$uri=[uri]$url;if($uri.Host -ne '127.0.0.1' -or $uri.Scheme -ne 'http'){throw 'Only local URLs are allowed'}}
$browserPaths=@((Join-Path $env:ProgramFiles 'Mozilla Firefox/firefox.exe'),(Join-Path $env:ProgramFiles 'Google/Chrome/Application/chrome.exe'),(Join-Path ${env:ProgramFiles(x86)} 'Microsoft/Edge/Application/msedge.exe'))
$browser=$browserPaths|Where-Object {Test-Path -LiteralPath $_}|Select-Object -First 1
if($browser){
  $browserArgs=@($demoUrls|ForEach-Object {'"'+$_+'"'})
  if($browser -notlike '*firefox.exe'){$browserArgs=@('--new-window')+$browserArgs}
  Start-Process -FilePath $browser -ArgumentList $browserArgs
}else{foreach($url in $demoUrls){Start-Process -FilePath $url}}
