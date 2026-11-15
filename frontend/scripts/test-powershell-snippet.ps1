param(
    [string]$ApiOrigin,
    [string]$CreateOnly,
    [string]$ReadLink
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot/../src/lib/1time.ps1"

if ($CreateOnly) { New-OneTimeLink -Secret $CreateOnly -HostUrl $ApiOrigin; return }
if ($ReadLink) { (Read-OneTimeLink $ReadLink).Text; return }

$failed = 0

function Test-Check([string]$Name, [scriptblock]$Body) {
    try {
        & $Body
        Write-Host "PASS $Name"
    } catch {
        $script:failed++
        Write-Host "FAIL $Name -- $($_.Exception.Message)"
    }
}

function Assert-Equal($Actual, $Expected) {
    if ($Actual -cne $Expected) { throw "expected '$Expected', got '$Actual'" }
}

function Assert-Throws([scriptblock]$Body, [string]$Pattern) {
    try { & $Body } catch {
        if ($_.Exception.Message -notmatch $Pattern) { throw "wrong error: $($_.Exception.Message)" }
        return
    }
    throw 'expected an error, none was thrown'
}

$key = 'K7bQ2mXp9vRt4nLw8zYc'
$goodFragment = "$key" + 'AbCdEfGhIjKlMnOpQrStUv'

Write-Host "PowerShell $($PSVersionTable.PSVersion) on .NET $([Environment]::Version)"

Test-Check 'V1 keys without passphrase' {
    $keys = Get-OneTimeKeys '' $key
    Assert-Equal $keys.ReadToken '5e6c13f429c1e6eb0c69bc2e67e98e7aa18db0a4bac73f943858694ac3fbe957'
    Assert-Equal $keys.ReadTokenHash '3bfecb0a1d1bc37a3e70eb843af6578ee1fa34c19fd059a89dfbdda4523bf396'
}

Test-Check 'V2 keys with passphrase' {
    $keys = Get-OneTimeKeys 'correct horse' $key
    Assert-Equal $keys.ReadToken '236c0385cdff9e6707c0ab1d20f936c0e6ab75dc5ce09170ca528cd39cc3a10f'
    Assert-Equal $keys.ReadTokenHash '323a850509f83d441ac10a8383cccbe356044213dd6439e9c7375eb788f35acc'
}

Test-Check 'V3 decrypts the published message' {
    $keys = Get-OneTimeKeys '' $key
    Assert-Equal (ConvertFrom-OneTimeCiphertext '9uCJlv0mLOve6cWh.-Z5xKVVauhg2NAM1n-AjlKZsT4m5sWjAYgKGql9AIl0' $keys.AesKey) 'hello from 1time'
}

Test-Check 'V5 link parsing' {
    $parts = ConvertFrom-OneTimeLink "https://1time.io/v/#$goodFragment"
    Assert-Equal $parts.Origin 'https://1time.io'
    Assert-Equal $parts.RandomKey $key
    Assert-Equal $parts.Id 'AbCdEfGhIjKlMnOpQrStUv'
}

Test-Check 'encrypt then decrypt, including non-ASCII' {
    $aesKey = (Get-OneTimeKeys 'pass' $key).AesKey
    foreach ($text in 'plain', "line1`nline2", 'Привет, мир 你好 🔐') {
        Assert-Equal (ConvertFrom-OneTimeCiphertext (ConvertTo-OneTimeCiphertext $text $aesKey) $aesKey) $text
    }
}

Test-Check 'two encryptions use different IVs' {
    $aesKey = (Get-OneTimeKeys '' $key).AesKey
    $first = (ConvertTo-OneTimeCiphertext 'same' $aesKey).Split('.')[0]
    $second = (ConvertTo-OneTimeCiphertext 'same' $aesKey).Split('.')[0]
    if ($first -ceq $second) { throw 'IV repeated' }
}

Test-Check 'random key is 20 alphabet characters' {
    $randomKey = New-OneTimeRandomKey
    if ($randomKey -cnotmatch '^[A-Za-z0-9_-]{20}\z') { throw 'bad key shape' }
}

Test-Check 'link: wrong length rejected' {
    Assert-Throws { ConvertFrom-OneTimeLink "https://1time.io/v/#$($goodFragment.Substring(1))" } 'not a 1time'
}

Test-Check 'link: character outside the alphabet rejected' {
    Assert-Throws { ConvertFrom-OneTimeLink "https://1time.io/v/#$($goodFragment.Substring(0, 41))!" } 'not a 1time'
}

Test-Check 'link: /f/ path rejected' {
    Assert-Throws { ConvertFrom-OneTimeLink "https://1time.io/f/#$goodFragment" } 'not a 1time'
}

Test-Check 'link: uppercase /V/ path rejected' {
    Assert-Throws { ConvertFrom-OneTimeLink "https://1time.io/V/#$goodFragment" } 'not a 1time'
}

Test-Check 'link: http on a non-loopback host rejected' {
    Assert-Throws { ConvertFrom-OneTimeLink "http://example.com/v/#$goodFragment" } 'loopback'
}

Test-Check 'link: http on loopback accepted' {
    Assert-Equal (ConvertFrom-OneTimeLink "http://127.0.0.1:8080/v/#$goodFragment").Origin 'http://127.0.0.1:8080'
}

Test-Check 'host: http on a non-loopback host rejected' {
    Assert-Throws { New-OneTimeLink -Secret 'x' -HostUrl 'http://example.com' } 'loopback'
}

if ($ApiOrigin) {
    Test-Check 'live: create then read, second read fails' {
        $text = 'secret ключ 🔐'
        $link = New-OneTimeLink -Secret $text -HostUrl $ApiOrigin
        Assert-Equal (Read-OneTimeLink $link).Text $text
        Assert-Throws { Read-OneTimeLink $link } 'no message'
    }

    Test-Check 'live: two views report one left' {
        $link = 'two views' | New-OneTimeLink -Views 2 -HostUrl $ApiOrigin
        Assert-Equal (Read-OneTimeLink $link).ViewsLeft 1
    }

    Test-Check 'live: wrong passphrase fails, correct one still works' {
        $link = New-OneTimeLink -Secret 'guarded' -Passphrase 'correct horse' -HostUrl $ApiOrigin
        Assert-Throws { Read-OneTimeLink $link } 'wrong key'
        Assert-Throws { Read-OneTimeLink $link -Passphrase 'nope' } 'wrong key'
        Assert-Equal (Read-OneTimeLink $link -Passphrase 'correct horse').Text 'guarded'
    }

    Test-Check 'live: invalid views rejected client-side' {
        Assert-Throws { New-OneTimeLink -Secret 'x' -Views 11 -HostUrl $ApiOrigin } 'Views'
    }

    Test-Check 'live: invalid expiry rejected client-side' {
        Assert-Throws { New-OneTimeLink -Secret 'x' -ExpiresInSeconds 0 -HostUrl $ApiOrigin } 'ExpiresInSeconds'
    }
}

if ($failed) { Write-Host "$failed check(s) failed"; exit 1 }
Write-Host 'All checks passed'
