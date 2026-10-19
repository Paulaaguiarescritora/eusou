$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
try {
    $wb = $excel.Workbooks.Open('D:\eusou\EuSou_Modelo_Importacao_Massa.xlsx')
    Write-Host "Sheets count: $($wb.Sheets.Count)"
    for ($i = 1; $i -le $wb.Sheets.Count; $i++) {
        $sheet = $wb.Sheets.Item($i)
        Write-Host "=== Sheet $i : $($sheet.Name) (Rows: $($sheet.UsedRange.Rows.Count), Cols: $($sheet.UsedRange.Columns.Count)) ==="
        $rowsToRead = [Math]::Min($sheet.UsedRange.Rows.Count, 30)
        for ($r = 1; $r -le $rowsToRead; $r++) {
            $rowVals = @()
            for ($c = 1; $c -le $sheet.UsedRange.Columns.Count; $c++) {
                $val = $sheet.Cells.Item($r, $c).Text
                $rowVals += $val
            }
            Write-Host "Row $r : $($rowVals -join ' | ')"
        }
    }
    $wb.Close($false)
} finally {
    $excel.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
}
