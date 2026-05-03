# Парсер ЭСН РК из docx → JSON
# PowerShell 5.1, Windows - корректно работает с Кириллицей

$ESN_DIR = "C:\Users\user\Downloads\esn_rk"
$OUT_FILE = "C:\Users\user\aevion-smeta-trainer\esn-parsed.json"

# Сборники для капремонта школы
$SBORNIKI = @(
    @{ num=11; pattern="Сборник 11"; category="отделочные" }
    @{ num=12; pattern="Сборник 12"; category="кровельные" }
    @{ num=15; pattern="Сборник 15"; category="отделочные" }
    @{ num=17; pattern="Сборник 17"; category="сантехнические" }
    @{ num=18; pattern="Сборник 18"; category="сантехнические" }
    @{ num=21; pattern="Сборник 21"; category="электромонтажные" }
)

Add-Type -AssemblyName WindowsBase

function Extract-DocxText($filePath) {
    $pkg = $null
    try {
        $pkg = [System.IO.Packaging.Package]::Open($filePath, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read)
        $partUri = [uri]"/word/document.xml"
        $part = $pkg.GetPart($partUri)
        $reader = [System.IO.StreamReader]::new($part.GetStream(), [System.Text.Encoding]::UTF8)
        $xml = $reader.ReadToEnd()
        $reader.Close()
        return $xml
    } finally {
        if ($pkg) { $pkg.Close() }
    }
}

function Parse-EsnTables($xml, $sbornikNum, $category) {
    $rates = @()

    # Убираем XML-теги, оставляем текст с разделителями ячеек
    # Строки таблицы: <w:tr> ... </w:tr>
    # Ячейки: <w:tc> ... </w:tc>
    # Текст: <w:t>...</w:t>

    # Извлекаем все строки таблиц
    $trMatches = [regex]::Matches($xml, '<w:tr[ >][\s\S]*?<\/w:tr>')

    $rows = @()
    foreach ($tr in $trMatches) {
        $cells = @()
        $tcMatches = [regex]::Matches($tr.Value, '<w:tc>[\s\S]*?<\/w:tc>')
        foreach ($tc in $tcMatches) {
            $texts = [regex]::Matches($tc.Value, '<w:t[^>]*>([\s\S]*?)<\/w:t>')
            $cellText = ($texts | ForEach-Object { $_.Groups[1].Value }) -join ""
            $cells += $cellText.Trim()
        }
        if ($cells.Count -gt 0) {
            $rows += ,@($cells)
        }
    }

    Write-Host "  Найдено строк таблиц: $($rows.Count)"

    $currentRate = $null
    $inResources = $false
    $resourceSection = ""

    foreach ($row in $rows) {
        if ($row.Count -eq 0) { continue }
        $first  = if ($row.Count -gt 0) { $row[0] } else { "" }
        $second = if ($row.Count -gt 1) { $row[1] } else { "" }
        $third  = if ($row.Count -gt 2) { $row[2] } else { "" }
        $fourth = if ($row.Count -gt 3) { $row[3] } else { "" }

        # Код нормы (таблицы) — формат XXXX-XXXX-XXXX или Таблица ...
        $tableMatch = [regex]::Match($first, '(\d{4}[-–]\d{4}[-–]\d{4}[-–]?\d*)')
        if ($tableMatch.Success) {
            if ($currentRate -and $currentRate.resources.Count -gt 0) {
                $rates += $currentRate
            }
            $rawCode = $tableMatch.Groups[1].Value -replace "–", "-"
            $numPad = $sbornikNum.ToString().PadLeft(2, "0")
            $currentRate = [PSCustomObject]@{
                code         = "Э$numPad-$rawCode"
                title        = if ($second) { $second } else { ($first -replace "Таблица\s+\S+\s*", "").Trim() }
                category     = $category
                unit         = ""
                composition  = @()
                resources    = @()
                baseCostPerUnit = 0
            }
            $inResources = $false
            $resourceSection = ""
            continue
        }

        if (-not $currentRate) { continue }

        # Единица измерения нормы
        if ($currentRate.unit -eq "" -and ($first -match "100\s*м²?" -or $first -match "^\s*м²?\s*$" -or $first -match "шт" -or $first -match "пог\.м" -or $first -match "м³?")) {
            $currentRate.unit = $first -replace "[()]", "" -replace "\s+", " "
        }

        # Состав работ
        if ($first -match "Состав работ" -or $second -match "Состав работ") {
            $inResources = $false; continue
        }
        if ($first -match "^\d+\." -and $currentRate.composition.Count -lt 5 -and -not $inResources) {
            $step = $first -replace "^\d+\.\s*", ""
            if ($step.Length -gt 3) { $currentRate.composition += $step }
        }

        # Разделы ресурсов
        if ($first -match "ЗАТРАТЫ ТРУДА" -or $second -match "Затраты труда рабочих") {
            $inResources = $true; $resourceSection = "труд"; continue
        }
        if ($first -match "МАШИНЫ" -or $second -match "Машины и механизм") {
            $inResources = $true; $resourceSection = "машины"; continue
        }
        if ($first -match "МАТЕРИАЛЫ" -or $second -match "Материалы, издел") {
            $inResources = $true; $resourceSection = "материал"; continue
        }

        # Строка ресурса: код (003-XXXX, 099-XXXX, 3XX-XXX, 2XX-XXX)
        if ($inResources -and $first -match "^\d{3}-" -and $row.Count -ge 4) {
            $qtyStr = $fourth -replace ",", "."
            $qty = 0.0
            if ([double]::TryParse($qtyStr, [System.Globalization.NumberStyles]::Float, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$qty)) {
                if ($qty -gt 0 -and $second -ne "") {
                    $kind = $resourceSection
                    if (-not $kind) {
                        if ($first -match "^003-" -or $first -match "^099-") { $kind = "труд" }
                        elseif ($first -match "^3[0-9]{2}-") { $kind = "машины" }
                        else { $kind = "материал" }
                    }
                    $currentRate.resources += [PSCustomObject]@{
                        kind  = $kind
                        code  = $first
                        name  = $second
                        unit  = $third
                        qty   = $qty
                    }
                }
            }
        }
    }

    if ($currentRate -and $currentRate.resources.Count -gt 0) { $rates += $currentRate }
    return $rates
}

# Главный цикл
$allResults = @{}
$totalRates = 0

foreach ($sb in $SBORNIKI) {
    Write-Host "Сборник $($sb.num)..." -NoNewline
    $files = Get-ChildItem $ESN_DIR | Where-Object { $_.Name -match $sb.pattern }
    if (-not $files) {
        Write-Host " файл не найден"
        $allResults[$sb.num] = @()
        continue
    }
    $filePath = $files[0].FullName
    try {
        $xml   = Extract-DocxText $filePath
        $rates = Parse-EsnTables $xml $sb.num $sb.category
        $allResults[$sb.num] = $rates
        $totalRates += $rates.Count
        Write-Host " $($rates.Count) расценок"
    } catch {
        Write-Host " ОШИБКА: $($_.Exception.Message.Substring(0, [Math]::Min(80, $_.Exception.Message.Length)))"
        $allResults[$sb.num] = @()
    }
}

# Сохраняем результат
$output = [PSCustomObject]@{ byCollection = $allResults }
$json = $output | ConvertTo-Json -Depth 10 -Compress:$false
[System.IO.File]::WriteAllText($OUT_FILE, $json, [System.Text.Encoding]::UTF8)

Write-Host "`nИтого: $totalRates расценок → esn-parsed.json"
