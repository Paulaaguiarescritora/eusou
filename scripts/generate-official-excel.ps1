$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
try {
    $srcWb = $excel.Workbooks.Open('D:\eusou\tabela-precos-marketplaces.xlsx')
    $destWb = $excel.Workbooks.Add()
    
    # Renomeia Sheet1 para PRODUTOS
    $wsProdutos = $destWb.Sheets.Item(1)
    $wsProdutos.Name = "PRODUTOS"
    
    # Cria PRECOS_MARKETPLACES, LISTAS, VALIDACAO
    $wsPrecos = $destWb.Sheets.Add([System.Reflection.Missing]::Value, $wsProdutos)
    $wsPrecos.Name = "PRECOS_MARKETPLACES"
    
    $wsListas = $destWb.Sheets.Add([System.Reflection.Missing]::Value, $wsPrecos)
    $wsListas.Name = "LISTAS"
    
    $wsValidacao = $destWb.Sheets.Add([System.Reflection.Missing]::Value, $wsListas)
    $wsValidacao.Name = "VALIDACAO"
    
    # ----------------------------------------------------
    # 1. ABA PRECOS_MARKETPLACES (Cópia fiel da Planilha1)
    # ----------------------------------------------------
    $srcSheet = $srcWb.Sheets.Item('Planilha1')
    $srcUsed = $srcSheet.UsedRange
    $srcUsed.Copy($wsPrecos.Range("A1"))
    
    # ----------------------------------------------------
    # 2. ABA LISTAS
    # ----------------------------------------------------
    $wsListas.Cells.Item(1, 1).Value2 = "NICHO"
    $wsListas.Cells.Item(2, 1).Value2 = "Pet Shop"
    
    $wsListas.Cells.Item(1, 2).Value2 = "CATEGORIA"
    $wsListas.Cells.Item(2, 2).Value2 = "Gatos"
    $wsListas.Cells.Item(3, 2).Value2 = "Cães e Gatos"
    $wsListas.Cells.Item(4, 2).Value2 = "Cães"
    
    $wsListas.Cells.Item(1, 3).Value2 = "SUBCATEGORIA"
    $wsListas.Cells.Item(2, 3).Value2 = "Decoração"
    $wsListas.Cells.Item(3, 3).Value2 = "Acessórios"
    
    $wsListas.Cells.Item(1, 4).Value2 = "STATUS"
    $wsListas.Cells.Item(2, 4).Value2 = "ACTIVE"
    $wsListas.Cells.Item(3, 4).Value2 = "DRAFT"
    $wsListas.Cells.Item(4, 4).Value2 = "INACTIVE"
    $wsListas.Cells.Item(5, 4).Value2 = "ARCHIVED"
    
    # Formata cabeçalhos de LISTAS
    $listHeaders = $wsListas.Range("A1:D1")
    $listHeaders.Font.Bold = $true
    $listHeaders.Interior.Color = 14540253 # cinza suave
    $wsListas.Columns.AutoFit()
    
    # ----------------------------------------------------
    # 3. ABA VALIDACAO
    # ----------------------------------------------------
    $valHeaders = @("LINHA", "SKU", "PRODUTO", "CAMPO", "PROBLEMA", "ORIGEM", "ACAO_NECESSARIA")
    for ($c = 1; $c -le $valHeaders.Length; $c++) {
        $wsValidacao.Cells.Item(1, $c).Value2 = $valHeaders[$c - 1]
    }
    $vHRange = $wsValidacao.Range("A1:G1")
    $vHRange.Font.Bold = $true
    $vHRange.Interior.Color = 13421823 # levemente avermelhado/salmão
    
    # ----------------------------------------------------
    # 4. ABA PRODUTOS
    # ----------------------------------------------------
    $prodHeaders = @(
        "SKU", "SKU_PRODUTO", "NOME_PRODUTO", "NICHO", "CATEGORIA", "SUBCATEGORIA",
        "DESCRICAO_CURTA", "DESCRICAO", "VARIANTE", "COR", "TAMANHO",
        "CUSTO", "ATACADO", "VAREJO", "MERCADO_LIVRE", "FACEBOOK", "SHOPEE", "TIKTOK_SHOP",
        "ESTOQUE_INICIAL", "IMAGEM_PRINCIPAL", "IMAGENS_ADICIONAIS", "TAGS", "STATUS"
    )
    for ($c = 1; $c -le $prodHeaders.Length; $c++) {
        $wsProdutos.Cells.Item(1, $c).Value2 = $prodHeaders[$c - 1]
    }
    $pHRange = $wsProdutos.Range("A1:W1")
    $pHRange.Font.Bold = $true
    $pHRange.Interior.Color = 15787990 # azul claro elegante
    
    # Preenchimento das Linhas de Produtos conhecidos
    # Linhas de modelo_produtos_eusou.csv
    $csvData = @(
        @("FEL-GAT-001-PRE", "FEL-GAT-001", "Porta Chaves Gatinho Felinodelia De Parede Minimalista", "Pet Shop", "Gatos", "Decoração", "Porta chaves decorativo em formato de gatinho felino com acabamento premium e ganchos reforçados.", "Porta chaves decorativo em formato de gatinho felino com acabamento premium e ganchos reforçados.", "Preto", "Preto", "", "10", "https://images.unsplash.com/photo-1543852786-1cf6624b9987", "ACTIVE"),
        @("FEL-GAT-001-BRA", "FEL-GAT-001", "Porta Chaves Gatinho Felinodelia De Parede Minimalista", "Pet Shop", "Gatos", "Decoração", "Porta chaves decorativo em formato de gatinho felino com acabamento premium e ganchos reforçados.", "Porta chaves decorativo em formato de gatinho felino com acabamento premium e ganchos reforçados.", "Branco", "Branco", "", "10", "https://images.unsplash.com/photo-1543852786-1cf6624b9987", "ACTIVE"),
        @("FEL-GAT-001-VER", "FEL-GAT-001", "Porta Chaves Gatinho Felinodelia De Parede Minimalista", "Pet Shop", "Gatos", "Decoração", "Porta chaves decorativo em formato de gatinho felino com acabamento premium e ganchos reforçados.", "Porta chaves decorativo em formato de gatinho felino com acabamento premium e ganchos reforçados.", "Vermelho", "Vermelho", "", "8", "https://images.unsplash.com/photo-1543852786-1cf6624b9987", "ACTIVE"),
        @("PET-MED-002-AZU", "PET-MED-002", "Medalha de Identificação Pet Personalizada com Nome", "Pet Shop", "Cães e Gatos", "Acessórios", "Medalha coleira leve, resistente e gravada a laser com dados do seu pet.", "Medalha coleira leve, resistente e gravada a laser com dados do seu pet.", "Azul", "Azul", "", "25", "", "ACTIVE"),
        @("PET-MED-002-ROS", "PET-MED-002", "Medalha de Identificação Pet Personalizada com Nome", "Pet Shop", "Cães e Gatos", "Acessórios", "Medalha coleira leve, resistente e gravada a laser com dados do seu pet.", "Medalha coleira leve, resistente e gravada a laser com dados do seu pet.", "Rosa", "Rosa", "", "25", "", "ACTIVE")
    )
    
    $rowIdx = 2
    foreach ($item in $csvData) {
        $wsProdutos.Cells.Item($rowIdx, 1).Value2 = $item[0]  # SKU
        $wsProdutos.Cells.Item($rowIdx, 2).Value2 = $item[1]  # SKU_PRODUTO
        $wsProdutos.Cells.Item($rowIdx, 3).Value2 = $item[2]  # NOME_PRODUTO
        $wsProdutos.Cells.Item($rowIdx, 4).Value2 = $item[3]  # NICHO
        $wsProdutos.Cells.Item($rowIdx, 5).Value2 = $item[4]  # CATEGORIA
        $wsProdutos.Cells.Item($rowIdx, 6).Value2 = $item[5]  # SUBCATEGORIA
        $wsProdutos.Cells.Item($rowIdx, 7).Value2 = $item[6]  # DESCRICAO_CURTA
        $wsProdutos.Cells.Item($rowIdx, 8).Value2 = $item[7]  # DESCRICAO
        $wsProdutos.Cells.Item($rowIdx, 9).Value2 = $item[8]  # VARIANTE
        $wsProdutos.Cells.Item($rowIdx, 10).Value2 = $item[9] # COR
        $wsProdutos.Cells.Item($rowIdx, 11).Value2 = $item[10]# TAMANHO
        
        # Preços: Não possuem correspondência exata em tabela-precos-marketplaces.xlsx, deixar vazio
        $wsProdutos.Cells.Item($rowIdx, 12).Value2 = "" # CUSTO
        $wsProdutos.Cells.Item($rowIdx, 13).Value2 = "" # ATACADO
        if ($item[0] -like "FEL-GAT*") {
            $wsProdutos.Cells.Item($rowIdx, 14).Value2 = 39.9
        } else {
            $wsProdutos.Cells.Item($rowIdx, 14).Value2 = 24.9
        }
        $wsProdutos.Cells.Item($rowIdx, 15).Value2 = "" # MERCADO_LIVRE
        $wsProdutos.Cells.Item($rowIdx, 16).Value2 = "" # FACEBOOK
        $wsProdutos.Cells.Item($rowIdx, 17).Value2 = "" # SHOPEE
        $wsProdutos.Cells.Item($rowIdx, 18).Value2 = "" # TIKTOK_SHOP
        
        $wsProdutos.Cells.Item($rowIdx, 19).Value2 = [int]$item[11] # ESTOQUE_INICIAL
        $wsProdutos.Cells.Item($rowIdx, 20).Value2 = $item[12]      # IMAGEM_PRINCIPAL
        $wsProdutos.Cells.Item($rowIdx, 21).Value2 = ""            # IMAGENS_ADICIONAIS
        $wsProdutos.Cells.Item($rowIdx, 22).Value2 = "pet;felinodelia;decoracao" # TAGS
        $wsProdutos.Cells.Item($rowIdx, 23).Value2 = $item[13]      # STATUS
        $rowIdx++
    }
    
    # 24 itens de tabela-precos-marketplaces.xlsx
    # Inserção das linhas de referência dos 24 produtos
    $mpSheet = $srcWb.Sheets.Item('Planilha1')
    for ($r = 4; $r -le 27; $r++) {
        $cod = $mpSheet.Cells.Item($r, 1).Text
        $nome = $mpSheet.Cells.Item($r, 2).Text
        $custo = [double]($mpSheet.Cells.Item($r, 3).Text -replace ',', '.')
        $atacado = [double]($mpSheet.Cells.Item($r, 4).Text -replace ',', '.')
        $varejo = [double]($mpSheet.Cells.Item($r, 5).Text -replace ',', '.')
        $ml = [double]($mpSheet.Cells.Item($r, 6).Text -replace ',', '.')
        $fb = [double]($mpSheet.Cells.Item($r, 7).Text -replace ',', '.')
        $shopee = [double]($mpSheet.Cells.Item($r, 8).Text -replace ',', '.')
        $tiktok = [double]($mpSheet.Cells.Item($r, 9).Text -replace ',', '.')
        
        $wsProdutos.Cells.Item($rowIdx, 1).Value2 = "" # SKU individual variante (pendente definir)
        $wsProdutos.Cells.Item($rowIdx, 2).Value2 = "MP-$cod" # SKU_PRODUTO
        $wsProdutos.Cells.Item($rowIdx, 3).Value2 = $nome
        $wsProdutos.Cells.Item($rowIdx, 4).Value2 = "Pet Shop"
        
        # Categorização com base no tipo de produto
        if ($nome -like "*Gato*" -or $nome -like "*felino*" -or $nome -like "*Peixe*" -or $nome -like "*Churumi*") {
            $wsProdutos.Cells.Item($rowIdx, 5).Value2 = "Gatos"
        } elseif ($nome -like "*cachorro*" -or $nome -like "*dog*") {
            $wsProdutos.Cells.Item($rowIdx, 5).Value2 = "Cães e Gatos"
        } else {
            $wsProdutos.Cells.Item($rowIdx, 5).Value2 = "Cães e Gatos"
        }
        
        if ($nome -like "*Chaveiro*" -or $nome -like "*Pingente*" -or $nome -like "*Medalha*") {
            $wsProdutos.Cells.Item($rowIdx, 6).Value2 = "Acessórios"
        } else {
            $wsProdutos.Cells.Item($rowIdx, 6).Value2 = "Decoração"
        }
        
        $wsProdutos.Cells.Item($rowIdx, 7).Value2 = "" # DESCRICAO_CURTA
        $wsProdutos.Cells.Item($rowIdx, 8).Value2 = "" # DESCRICAO
        $wsProdutos.Cells.Item($rowIdx, 9).Value2 = "" # VARIANTE
        $wsProdutos.Cells.Item($rowIdx, 10).Value2 = "" # COR
        $wsProdutos.Cells.Item($rowIdx, 11).Value2 = "" # TAMANHO
        
        $wsProdutos.Cells.Item($rowIdx, 12).Value2 = $mpSheet.Cells.Item($r, 3).Text
        $wsProdutos.Cells.Item($rowIdx, 13).Value2 = $mpSheet.Cells.Item($r, 4).Text
        $wsProdutos.Cells.Item($rowIdx, 14).Value2 = $mpSheet.Cells.Item($r, 5).Text
        $wsProdutos.Cells.Item($rowIdx, 15).Value2 = $mpSheet.Cells.Item($r, 6).Text
        $wsProdutos.Cells.Item($rowIdx, 16).Value2 = $mpSheet.Cells.Item($r, 7).Text
        $wsProdutos.Cells.Item($rowIdx, 17).Value2 = $mpSheet.Cells.Item($r, 8).Text
        $wsProdutos.Cells.Item($rowIdx, 18).Value2 = $mpSheet.Cells.Item($r, 9).Text
        
        $wsProdutos.Cells.Item($rowIdx, 19).Value2 = "" # ESTOQUE_INICIAL
        $wsProdutos.Cells.Item($rowIdx, 20).Value2 = "" # IMAGEM_PRINCIPAL
        $wsProdutos.Cells.Item($rowIdx, 21).Value2 = "" # IMAGENS_ADICIONAIS
        $wsProdutos.Cells.Item($rowIdx, 22).Value2 = "" # TAGS
        $wsProdutos.Cells.Item($rowIdx, 23).Value2 = "DRAFT" # STATUS
        
        $rowIdx++
    }
    
    # ----------------------------------------------------
    # Validações registradas na aba VALIDACAO
    # ----------------------------------------------------
    $valRows = @(
        @("2", "FEL-GAT-001-PRE", "Porta Chaves Gatinho", "PRECOS_MARKETPLACES", "Produto de modelo_produtos_eusou.csv não consta na tabela-precos-marketplaces.xlsx", "modelo_produtos_eusou.csv", "Cadastrar custos e preços multicanal"),
        @("3", "FEL-GAT-001-BRA", "Porta Chaves Gatinho", "PRECOS_MARKETPLACES", "Produto de modelo_produtos_eusou.csv não consta na tabela-precos-marketplaces.xlsx", "modelo_produtos_eusou.csv", "Cadastrar custos e preços multicanal"),
        @("4", "FEL-GAT-001-VER", "Porta Chaves Gatinho", "PRECOS_MARKETPLACES", "Produto de modelo_produtos_eusou.csv não consta na tabela-precos-marketplaces.xlsx", "modelo_produtos_eusou.csv", "Cadastrar custos e preços multicanal"),
        @("5", "PET-MED-002-AZU", "Medalha de Identificação Pet", "PRECOS_MARKETPLACES", "Produto de modelo_produtos_eusou.csv não consta na tabela-precos-marketplaces.xlsx", "modelo_produtos_eusou.csv", "Cadastrar custos e preços multicanal"),
        @("6", "PET-MED-002-ROS", "Medalha de Identificação Pet", "PRECOS_MARKETPLACES", "Produto de modelo_produtos_eusou.csv não consta na tabela-precos-marketplaces.xlsx", "modelo_produtos_eusou.csv", "Cadastrar custos e preços multicanal")
    )
    
    # Registra itens de marketplaces sem SKU individual de variante
    $vRowIdx = 2
    foreach ($vr in $valRows) {
        for ($c = 1; $c -le 7; $c++) {
            $wsValidacao.Cells.Item($vRowIdx, $c).Value2 = $vr[$c - 1]
        }
        $vRowIdx++
    }
    
    for ($r = 7; $r -le 30; $r++) {
        $pRow = $r
        $pNome = $wsProdutos.Cells.Item($pRow, 3).Text
        $wsValidacao.Cells.Item($vRowIdx, 1).Value2 = "$pRow"
        $wsValidacao.Cells.Item($vRowIdx, 2).Value2 = ""
        $wsValidacao.Cells.Item($vRowIdx, 3).Value2 = $pNome
        $wsValidacao.Cells.Item($vRowIdx, 4).Value2 = "SKU / VARIANTE / IMAGEM"
        $wsValidacao.Cells.Item($vRowIdx, 5).Value2 = "Item da tabela de preços não possui SKU de variante, estoque inicial e imagem cadastrados"
        $wsValidacao.Cells.Item($vRowIdx, 6).Value2 = "tabela-precos-marketplaces.xlsx"
        $wsValidacao.Cells.Item($vRowIdx, 7).Value2 = "Definir SKUs de variantes, cores e imagens antes da importação"
        $vRowIdx++
    }
    
    # ----------------------------------------------------
    # Formatação Numérica de Moeda na aba PRODUTOS
    # ----------------------------------------------------
    $priceRange = $wsProdutos.Range("L2:R100")
    $priceRange.NumberFormat = "R$ #,##0.00"
    
    # ----------------------------------------------------
    # Validação de Dados (Listas Suspensas) no Excel
    # ----------------------------------------------------
    # NICHO (Coluna D) -> =LISTAS!$A$2:$A$2
    $nichoRange = $wsProdutos.Range("D2:D100")
    $nichoRange.Validation.Delete()
    $nichoRange.Validation.Add(3, 1, 1, "=LISTAS!`$A`$2:`$A`$2") # 3 = xlValidateList
    $nichoRange.Validation.IgnoreBlank = $true
    $nichoRange.Validation.InCellDropdown = $true
    
    # CATEGORIA (Coluna E) -> =LISTAS!$B$2:$B$4
    $catRange = $wsProdutos.Range("E2:E100")
    $catRange.Validation.Delete()
    $catRange.Validation.Add(3, 1, 1, "=LISTAS!`$B`$2:`$B`$4")
    $catRange.Validation.IgnoreBlank = $true
    $catRange.Validation.InCellDropdown = $true
    
    # SUBCATEGORIA (Coluna F) -> =LISTAS!$C$2:$C$3
    $subcatRange = $wsProdutos.Range("F2:F100")
    $subcatRange.Validation.Delete()
    $subcatRange.Validation.Add(3, 1, 1, "=LISTAS!`$C`$2:`$C`$3")
    $subcatRange.Validation.IgnoreBlank = $true
    $subcatRange.Validation.InCellDropdown = $true
    
    # STATUS (Coluna W) -> =LISTAS!$D$2:$D$5
    $statusRange = $wsProdutos.Range("W2:W100")
    $statusRange.Validation.Delete()
    $statusRange.Validation.Add(3, 1, 1, "=LISTAS!`$D`$2:`$D`$5")
    $statusRange.Validation.IgnoreBlank = $true
    $statusRange.Validation.InCellDropdown = $true
    
    # Auto-ajuste de colunas
    $wsProdutos.Columns.AutoFit()
    $wsPrecos.Columns.AutoFit()
    $wsValidacao.Columns.AutoFit()
    
    # Salva arquivo XLSX final
    $outputPath = "D:\eusou\modelo_importacao_produtos_eusou.xlsx"
    if (Test-Path $outputPath) { Remove-Item $outputPath -Force }
    $destWb.SaveAs($outputPath, 51) # 51 = xlOpenXMLWorkbook (.xlsx)
    $destWb.Close($false)
    $srcWb.Close($false)
    Write-Host "Arquivo modelo_importacao_produtos_eusou.xlsx gerado com sucesso!"
} finally {
    $excel.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
}
