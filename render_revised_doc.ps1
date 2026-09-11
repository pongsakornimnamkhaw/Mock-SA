$docPath = (Get-ChildItem -LiteralPath 'D:\SA\Mock-SA' -Filter '*.docx' | Where-Object { -not $_.Name.StartsWith('~$') } | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName
$pdfPath = 'D:\SA\Mock-SA\_rendered_revised.pdf'
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
try {
    $doc = $word.Documents.Open($docPath, $false, $true)
    $pages = $doc.ComputeStatistics(2)
    $doc.ExportAsFixedFormat($pdfPath, 17)
    Write-Output "pages=$pages"
} finally {
    if ($doc) { $doc.Close($false) }
    $word.Quit()
}
