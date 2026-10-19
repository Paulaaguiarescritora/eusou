$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
try {
    $wb = $excel.Workbooks.Open('D:\eusou\tabela-precos-marketplaces.xlsx')
    Write-Host "Sheets count: $($wb.Sheets.Count)"
    for ($i = 1; $i -le $wb.Sheets.Count; $i++) {
        $sheet = $wb.Sheets.Item($i)
        Write-Host "Sheet name: $($sheet.Name)"
        $used = $sheet.UsedRange
        Write-Host "Rows: $($used.Rows.Count), Cols: $($used.Columns.Count)"
        
        # Le as primeiras 15 linhas
        $rowsToRead = [Math]::Min($used.Rows.Count, 15)
        for ($r = 1; $r -le $rowsToRead; $r++) {
            $rowVals = @()
            for ($c = 1; $c -le $used.Columns.Count; $c++) {
                $val = $sheet.Cells.Item($r, $c).Text
                $rowVals += $val
            }
            Write-Host "Row $r : $($rowVals -join ' | ')"
        }
    }
    $wb.Close($false)
} finally {
    $excel.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
}
