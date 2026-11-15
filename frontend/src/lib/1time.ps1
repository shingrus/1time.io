#Requires -Version 7.2
# Put your own contact URL here (homepage, repository or mailto:); it is sent in the User-Agent.
$OneTimeContactUrl = ''

function ConvertTo-OneTimeBase64Url([byte[]]$Bytes) {
    [Convert]::ToBase64String($Bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

function ConvertFrom-OneTimeBase64Url([string]$Text) {
    $standard = $Text.Replace('-', '+').Replace('_', '/')
    [Convert]::FromBase64String($standard.PadRight($standard.Length + (4 - $standard.Length % 4) % 4, '='))
}

function New-OneTimeRandomKey {
    $alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
    $random = [Security.Cryptography.RandomNumberGenerator]
    -join (1..20 | ForEach-Object { $alphabet[$random::GetInt32($alphabet.Length)] })
}

function Get-OneTimeKeys([string]$Passphrase, [string]$RandomKey) {
    $utf8 = [Text.Encoding]::UTF8
    $material = $utf8.GetBytes($Passphrase + $RandomKey)
    $salt = $utf8.GetBytes('onetimelink:v2')
    $sha256 = [Security.Cryptography.HashAlgorithmName]::SHA256
    $authBytes = [Security.Cryptography.HKDF]::DeriveKey($sha256, $material, 32, $salt, $utf8.GetBytes('auth'))
    $readToken = [Convert]::ToHexString($authBytes).ToLowerInvariant()
    $aesKey = [Security.Cryptography.HKDF]::DeriveKey($sha256, $material, 32, $salt, $utf8.GetBytes('encrypt'))
    $hashBytes = [Security.Cryptography.SHA256]::HashData($utf8.GetBytes($readToken))
    [pscustomobject]@{
        AesKey        = $aesKey
        ReadToken     = $readToken
        ReadTokenHash = [Convert]::ToHexString($hashBytes).ToLowerInvariant()
    }
}

function ConvertTo-OneTimeCiphertext([string]$Text, [byte[]]$AesKey) {
    $plain = [Text.Encoding]::UTF8.GetBytes($Text)
    $iv = [Security.Cryptography.RandomNumberGenerator]::GetBytes(12)
    $cipher = [byte[]]::new($plain.Length)
    $tag = [byte[]]::new(16)
    $aes = [Security.Cryptography.AesGcm]::new($AesKey)
    try { $aes.Encrypt($iv, $plain, $cipher, $tag) } finally { $aes.Dispose() }
    (ConvertTo-OneTimeBase64Url $iv) + '.' + (ConvertTo-OneTimeBase64Url ([byte[]]($cipher + $tag)))
}

function ConvertFrom-OneTimeCiphertext([string]$Wire, [byte[]]$AesKey) {
    $ivText, $bodyText = $Wire.Split('.')
    $iv = ConvertFrom-OneTimeBase64Url $ivText
    $body = ConvertFrom-OneTimeBase64Url $bodyText
    $cipher = [byte[]]::new($body.Length - 16)
    $tag = [byte[]]::new(16)
    [Array]::Copy($body, $cipher, $cipher.Length)
    [Array]::Copy($body, $cipher.Length, $tag, 0, 16)
    $plain = [byte[]]::new($cipher.Length)
    $aes = [Security.Cryptography.AesGcm]::new($AesKey)
    try { $aes.Decrypt($iv, $cipher, $tag, $plain) } finally { $aes.Dispose() }
    [Text.Encoding]::UTF8.GetString($plain)
}

function Get-OneTimeOrigin([string]$Url) {
    $uri = $null
    if (-not [Uri]::TryCreate($Url, 'Absolute', [ref]$uri) -or $uri.Scheme -notin 'http', 'https') {
        throw 'Expected an http(s) URL.'
    }
    if ($uri.Scheme -eq 'http' -and $uri.Host -notin '127.0.0.1', 'localhost', '[::1]') {
        throw 'Plain http is only allowed for loopback hosts; use https.'
    }
    $uri.GetLeftPart('Authority')
}

function ConvertFrom-OneTimeLink([string]$Link) {
    $origin = Get-OneTimeOrigin $Link
    $uri = [Uri]$Link
    $fragment = $uri.Fragment.TrimStart('#')
    if ($uri.AbsolutePath -cne '/v/' -or $fragment -cnotmatch '^[A-Za-z0-9_-]{42}\z') {
        throw 'Not a 1time text link: expected /v/# followed by 42 characters.'
    }
    [pscustomobject]@{ Origin = $origin; RandomKey = $fragment.Substring(0, 20); Id = $fragment.Substring(20) }
}

function Invoke-OneTimeApi([string]$Origin, [string]$Endpoint, [hashtable]$Body) {
    $userAgent = if ($OneTimeContactUrl) { "1time-pwsh/1.0 (+$OneTimeContactUrl)" } else { '1time-pwsh/1.0' }
    $request = @{
        Method             = 'Post'
        Uri                = "$Origin/api/${Endpoint}?src=pwsh"
        Body               = $Body | ConvertTo-Json -Compress
        ContentType        = 'application/json'
        UserAgent          = $userAgent
        TimeoutSec         = 60
        SkipHttpErrorCheck = $true
        StatusCodeVariable = 'statusCode'
    }
    for ($attempt = 1; ; $attempt++) {
        $response = Invoke-RestMethod @request
        if ($statusCode -eq 503 -and $response.status -eq 'retry' -and $attempt -lt 4) {
            Start-Sleep -Milliseconds (250 * $attempt)
            continue
        }
        if ($statusCode -ne 200) { throw "1time API answered HTTP $statusCode." }
        return $response
    }
}

function New-OneTimeLink {
    param(
        [Parameter(Mandatory, ValueFromPipeline)][string]$Secret,
        [ValidateRange(1, 2592000)][int]$ExpiresInSeconds = 86400,
        [ValidateRange(1, 10)][int]$Views = 1,
        [string]$Passphrase = '',
        [string]$HostUrl = 'https://1time.io'
    )
    process {
        $origin = Get-OneTimeOrigin $HostUrl
        $randomKey = New-OneTimeRandomKey
        $keys = Get-OneTimeKeys $Passphrase $randomKey
        $response = Invoke-OneTimeApi $origin 'saveSecret' @{
            secretMessage = ConvertTo-OneTimeCiphertext $Secret $keys.AesKey
            readTokenHash = $keys.ReadTokenHash
            v             = 3
            duration      = $ExpiresInSeconds
            views         = $Views
        }
        if ($response.status -ne 'ok' -or $response.newId -cnotmatch '^[A-Za-z0-9_-]{22}\z') {
            throw 'The server did not accept the secret.'
        }
        "$origin/v/#$randomKey$($response.newId)"
    }
}

function Read-OneTimeLink {
    param(
        [Parameter(Mandatory)][string]$Link,
        [string]$Passphrase = ''
    )
    $parts = ConvertFrom-OneTimeLink $Link
    $keys = Get-OneTimeKeys $Passphrase $parts.RandomKey
    $response = Invoke-OneTimeApi $parts.Origin 'get' @{ id = $parts.Id; hashedKey = $keys.ReadToken }
    switch ($response.status) {
        'ok' {
            [pscustomobject]@{
                Text      = ConvertFrom-OneTimeCiphertext $response.cryptedMessage $keys.AesKey
                ViewsLeft = [int]$response.viewsLeft
                ExpiresIn = [int]$response.expiresIn
            }
        }
        'wrong key' { throw 'Wrong key: the passphrase is missing or incorrect.' }
        'no message' { throw 'No message: already read, expired or never existed.' }
        default { throw 'The server could not process the request.' }
    }
}
