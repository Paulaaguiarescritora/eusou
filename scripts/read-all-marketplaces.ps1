$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
try {
    $wb = $excel.Workbooks.Open('D:\eusou\tabela-precos-marketplaces.xlsx')
    $sheet = $wb.Sheets.Item('Planilha1')
    $used = $sheet.UsedRange
    
    for ($r = 3; $r -le $used.Rows.Count; $r++) {
        $rowVals = @()
        for ($c = 1; $c -le 9; $c++) {
            $val = $sheet.Cells.Item($r, $c).Text
            $rowVals += $val
        }
        Write-Host "Row $r : $($rowVals -join ' | ')"
    }
    $wb.Close($false)
} finally {
    $excel.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
}
