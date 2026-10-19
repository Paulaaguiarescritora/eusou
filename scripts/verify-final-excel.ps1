$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
try {
    $wb = $excel.Workbooks.Open('D:\eusou\modelo_importacao_produtos_eusou.xlsx')
    Write-Host "Total Sheets: $($wb.Sheets.Count)"
    for ($i = 1; $i -le $wb.Sheets.Count; $i++) {
        $ws = $wb.Sheets.Item($i)
        $u = $ws.UsedRange
        Write-Host "Aba: $($ws.Name) | Linhas: $($u.Rows.Count) | Colunas: $($u.Columns.Count)"
    }
    $wb.Close($false)
} finally {
    $excel.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
}
