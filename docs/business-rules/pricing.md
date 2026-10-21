# Motor de tarifas

Implementado na Fase 5. Configuração, limites e homologação em [reservations.md](../reservations.md); motor em `src/lib/pricing/engine.ts` e migrations 16–18.

Entrada: período com instantes e timezone comercial, alvo, plano, adicionais, retirada/devolução e eventual desconto autorizado. Saída: itens, quantidade, preço unitário, subtotal, desconto, taxas, total, caução separada, moeda, validade e versão das regras. Nunca aceitar um total calculado pelo navegador.

## Regras

- `rate_plans` define unidade e políticas; `rate_plan_prices` diferencia categoria/veículo e vigência; `pricing_rules` armazena regras versionadas e validadas por tipo.
- Preferência de tarifa específica sobre categoria é explícita e determinística. Não permitir duas tarifas igualmente prioritárias no mesmo escopo/período.
- Diária/semanal usam política de duração definida. Mensal é calendário (preservar aniversário com tratamento de fim de mês) ou comercial com quantidade de dias configurada. Nunca fixar todo mês em 30 dias.
- Pacotes combinados e cobrança de excedentes seguem estratégia configurada; não presumir que a combinação mais barata é sempre a política da empresa.
- Tolerância, fração de hora, arredondamento e ordem de descontos/taxas são versões de regra. Descontos exigem cargo, limite e motivo; não podem tornar o total negativo.
- Entrega/coleta têm taxas configuradas incluídas nos itens. Não usar distância sem provedor e regra aprovados.
- Caução não compõe receita recebida. Multas/encargos posteriores são cobranças adicionais auditáveis, sem reescrever contrato.
- Persistir `quotes` e `quote_items`, com versão e snapshot detalhado; orçamento expirado exige recotação. Aprovação usa snapshot explicitamente aceito.

## Precisão

PostgreSQL `numeric(12,2)` e JSON decimal em string. Motor com centavos `bigint`, arredondamento configurável por linha e quantidade com quatro casas; total/caução separados. Unidade, quantidade e duração são campos distintos de valor monetário. Tarifas devem cobrir a locação inteira; não há divisão automática entre vigências. Snapshot aceito na solicitação permanece válido para aprovação até o prazo de análise, mesmo que o prazo original da cotação termine depois da solicitação.

## Testes exigidos

Diária, semanal, mês de fevereiro/ano bissexto, fim de mês, intervalo cruzando mudança de offset, tolerância nos limites, pacotes combinados, regra ausente, vigência sobreposta, precedência veículo/categoria, desconto sem permissão, totais máximos, arredondamento, taxas de logística, caução separada e reprodução do snapshot após mudança de tarifa.
