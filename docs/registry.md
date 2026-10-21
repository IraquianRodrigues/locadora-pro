# Cadastros e arquivos privados — Fase 4

## Entrega

Cadastros reais de categorias, veículos, clientes PF/PJ e condutores, além de unidades como pré-requisito da frota. As telas em `/admin/categorias`, `/admin/frota`, `/admin/clientes`, `/admin/condutores` e `/admin/unidades` usam a sessão SSR do funcionário. A mesma camada de serviço atende Server Actions e REST. Não há dados de demonstração nem cliente de serviço nos CRUDs.

Cada módulo oferece consulta, criação, edição, arquivamento e restauração, com campos validados no cliente e novamente no servidor. Arquivamento é o DELETE lógico previsto no plano: preserva IDs, documentos e histórico. Registros arquivados ficam consultáveis pelo filtro; para editar, é preciso restaurar. Restaurar conserva os demais campos, inclusive ativo/situação anterior.

Listagens têm 20 registros por página, busca literal por nome (frota: placa), opção de arquivados e desempate por ID. Frota tem filtros de categoria e situação. Seletores de vínculos mostram até 100 resultados e permitem buscar novamente por nome, evitando carregar todos os clientes. Edição e arquivamento exigem `updated_at` exato; conflito concorrente retorna 409 sem sobrescrever a outra edição.

Veículos incluem categoria/unidade, placa, chassi/RENAVAM opcionais, marca/modelo/versão, anos, cor, combustível, câmbio, passageiros/portas, km, aquisição, características, descrição, situação e notas. O detalhe consulta histórico de locações e manutenção reais, 20 registros por página, somente quando a permissão correspondente existe. A tela não cria esses eventos; os fluxos completos são fases posteriores.

## Permissões

| Recurso                    | Consulta                        | Cadastro/edição/arquivamento     |
| -------------------------- | ------------------------------- | -------------------------------- |
| Categorias                 | categories.read                 | categories.write                 |
| Frota                      | vehicles.read                   | vehicles.write                   |
| Clientes                   | customers.read                  | customers.write                  |
| Condutores                 | drivers.read                    | drivers.write                    |
| Unidades                   | operations.read                 | settings.manage                  |
| Fotos de categoria/veículo | Leitura do recurso              | Escrita do recurso               |
| Documento de veículo       | vehicles.read + documents.read  | vehicles.read + documents.write  |
| Documento de cliente       | customers.read + documents.read | customers.read + documents.write |
| Documento de condutor      | drivers.read + documents.read   | drivers.read + documents.write   |

ADMIN tem todos os cadastros; MANAGER edita frota/categorias/clientes/condutores, mas apenas consulta unidades. ATTENDANT consulta frota/categorias, cadastra clientes/condutores e anexa documentos conforme a matriz. FINANCE consulta categorias e suas imagens; não recebe clientes/frota brutos, CNH ou outros documentos pessoais. A interface oculta ações sem permissão e cada entrada repete RBAC no servidor; a RLS é uma proteção adicional. UPDATE negado pela RLS pode afetar zero linhas, sem lançar erro SQL — a aplicação valida a permissão e a linha retornada.

## Validações brasileiras e integridade

- CPF e CNPJ normalizados, sem pontuação, com DV verificado; CNPJ numérico e alfanumérico, em maiúsculas, com ASCII menos 48 conforme a Receita. Unicidade permanece no banco, inclusive em arquivados.
- Telefone nacional com DDD brasileiro, fixo/celular; aceita formatação e prefixo +55. E-mail normalizado para minúsculas. Endereço exige CEP de oito dígitos, logradouro, número ou S/N, bairro, cidade e UF válida, com complemento opcional. Não há consulta automática de existência de CEP.
- Datas civis não aceitam rollover. Nascimento é somente PF e não pode ser futuro. CNH exige formato de 11 dígitos, sem sequência repetida, categoria da lista e validade real. Vencimento é aceito para registrar o documento e aparece como alerta; cadastro não autoriza retirada.
- Placa antiga/Mercosul normalizada e única; chassi opcional com 17 caracteres sem I/O/Q; RENAVAM opcional, numérico, de 9 a 11 posições e único. Anos respeitam o intervalo do schema (1900–2200), com modelo entre fabricação e fabricação + 2; km não pode diminuir. Combustível/câmbio têm allowlist.
- Não são verificadas autenticidade, situação na Receita/DETRAN/SENATRAN ou DV de CNH/RENAVAM. A existência documental e as condições de retirada precisam de conferência operacional nas fases correspondentes. Não há integração externa contratada.
- Banco bloqueia edição de arquivados, troca de ID, veículo vinculado a categoria/unidade indisponível e novo condutor de cliente arquivado. Categoria/unidade com veículos não arquivados não pode ser desativada/arquivada. Cliente com condutor não arquivado, reserva pendente/confirmada ou locação em curso não pode ser arquivado.
- Veículo com alocação atual/futura ou locação PREPARING/ACTIVE/OVERDUE não pode ser arquivado nem ter categoria/unidade/situação alteradas. Condutor em locação em curso não pode ser arquivado. Travas de pais e FKs preservam vínculos; concorrência pode abortar uma operação com conflito e exigir atualização/repetição.

## Storage autorizado

As migrations 14/15 são novas; 01–13 foram preservadas. Há agora **54 tabelas**. `registry_files` é a fonte dos anexos destes cadastros, com FKs específicas de categoria/veículo/cliente/condutor, UUID, caminho, tipo, tamanho, SHA-256, autor e estado PENDING/READY/FAILED/ARCHIVED. Tabelas e caminhos antigos continuam para compatibilidade e evidências anteriores; novos anexos não são duplicados em `vehicle_images`, `customer_documents`, `drivers.document_path` ou `vehicle_categories.image_path`. A fase pública deverá integrar explicitamente a nova fonte para publicar imagens autorizadas.

O fluxo é:

1. Conferir origem, sessão, permissão de recurso/arquivo, proprietário não arquivado e limite de 20 uploads/funcionário a cada 15 minutos (com limite global de 1000 por fluxo).
2. Validar tamanho real entre 1 byte e **4 MiB**, extensão, MIME e assinatura do conteúdo. JPEG/PNG/WebP são decodificados com Sharp, limite de 20 milhões de pixels, sem animação, tempo de processamento limitado; convertidos para JPEG até 2560×2560, sem EXIF/metadados e com fundo branco.
3. PDFs só são aceitos em documentos, com assinatura/versão, marcador final e bloqueio básico de nomes de ações/conteúdo ativo/incorporado/criptografado. Esta inspeção não é um parser completo nem antivírus; não comprova ausência de malware. PDFs preservam os bytes originais e são entregues como download. Scanner/quarentena para documentos e política de conferência continuam pendentes da infraestrutura/homologação antes de uso comercial.
4. Gerar UUID/caminho no servidor, criar metadado PENDING e enviar o conteúdo validado, sem upsert. A chave de serviço é usada **apenas nesta operação delimitada** e na compensação, além do limitador já existente. O caminho nunca vem do navegador. Escritas diretas de funcionários no Storage para `vehicle-images`/`documents` são negadas, impedindo contornar a validação de conteúdo.
5. Revalidar a permissão após o upload e marcar READY somente quando o objeto existe. Falha tenta apagar somente o caminho recém-gerado e marcar FAILED; sem conclusão não anuncia sucesso nem fornece download.
6. Download usa o cliente da sessão, RLS e URL assinada por **60 segundos**, com nome por UUID e `download`. Não usa `getPublicUrl`. Arquivamento do anexo passa por RPC com nova checagem de permissão; conteúdo e vínculos ficam imutáveis.

Os buckets continuam privados: fotos em `vehicle-images` e documentos em `documents`. Caminho `<UUID da entidade>/<UUID do arquivo>.jpg|pdf`; o nome original não é armazenado. Objetos de arquivos novos PENDING/FAILED/ARCHIVED não ficam disponíveis por RLS, mesmo que alguém tente criar metadado legado para o mesmo caminho. Signed URLs emitidas antes de revogação/arquivamento podem funcionar até os 60 segundos expirarem; revogação imediata exigiria apagar o objeto ou proxy de download, não foi alegada nesta entrega.

Sem acesso atual ao objeto, não é possível gerar novos links. Não registrar URLs assinadas em logs/APM nem armazená-las em cache. O navegador recebe links somente após ação autorizada e usa no-referrer. Não editar `storage.objects` por SQL para apagar arquivos reais: exclusão física deve usar a API Storage.

## Configuração e homologação Supabase pendentes

1. Configurar Auth e segredos conforme `authentication.md`, aplicar migrations em desenvolvimento e gerar os tipos oficiais. Nenhum projeto remoto foi modificado nesta entrega. Para dados existentes, revisar nomes de categoria/unidade duplicados sem diferença de caixa e RENAVAM duplicado: os índices novos abortam diante de conflito, sem corrigir/apagar dados silenciosamente.
2. `customer_br_address`, `branch_br_address`, `license_not_repeated` e `fleet_classification` são constraints NOT VALID para permitir revisão de legado. Elas já conferem INSERT/UPDATE novos. Identificar/sanear o legado e executar `ALTER TABLE ... VALIDATE CONSTRAINT ...` antes de produção. Endereços vazios antigos não podem ser salvos sem completar os campos.
3. Confirmar buckets privados e MIME/limites compatíveis: `vehicle-images` aceita JPEG e `documents` aceita JPEG/PDF. O app usa limite mais estrito de 4 MiB. Revisar policies preexistentes: policies permissivas adicionais podem se somar por OR. Usar projeto dedicado; não expor `app_private`. A policy antiga de INSERT é limitada a inspeções; seus controles de conteúdo pertencem à fase de vistorias.
4. Disponibilizar service role somente no servidor para upload validado/compensação e metadados, nunca como cliente de CRUD. Verificar acesso HTTP Storage com sessão de cada perfil e tentativa de upload direto; o erro esperado é negação mesmo para ADMIN via cliente normal.
5. Garantir runtime Node compatível com Sharp/native libs. Next Server Actions está configurado com limite total de 5 MB; a hospedagem/proxy precisa aceitar multipart de 4 MiB mais overhead. Não configurar cache de Auth/admin/API e não enviar documentos ou URLs assinadas a analytics.
6. Criar primeira unidade pelo ADMIN em `/admin/unidades` e categorias ativas antes de cadastrar veículos. Cliente não arquivado precede condutor. Dados reais e regras de conferência são responsabilidade da locadora; nenhum seed é automático.
7. Definir retenção de documentos e tarefa administrativa de reconciliação. Examinar registros PENDING antigos e FAILED, conferir o objeto na API Storage e excluir por API somente órfãos comprovados. Não promover PENDING para READY sem validar conteúdo/hash/autor. Não há worker de reconciliação ou antivírus configurado nesta fase. Objetos arquivados são retidos para histórico, sem descarte automático.

### Matriz de homologação da stack completa

| Cenário com dados exclusivos de desenvolvimento                                      | Resultado exigido                                                                    |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| ADMIN cria unidade/categoria/veículo, recarrega e edita                              | Persistência real, filtros e paginação, vínculos e mensagens corretos                |
| ATTENDANT cria PF/PJ/condutor; tenta gravar frota/categoria                          | Cadastro permitido apenas nos próprios escopos, negação direta da API nos demais     |
| FINANCE abre clientes/frota/condutores e tenta ler documentos pelo PostgREST/Storage | Sem exposição de linhas/arquivos pessoais                                            |
| Cadastro duplicado e edição simultânea em dois browsers                              | Conflito consistente; nenhuma sobreposição silenciosa                                |
| Arquivar/restaurar, com e sem dependências                                           | Histórico preservado e bloqueios consistentes; edição de arquivado negada            |
| PNG/JPEG/WebP, PDF permitido, arquivo adulterado/grande/ativo                        | Conteúdo permitido persistido; demais recusados; verificar JPEG sem EXIF no download |
| Upload interrompido ou permissão revogada durante envio                              | Sem READY indevido; compensação/reconciliação observáveis                            |
| Download e arquivo arquivado, sessão expirada/revogada, token assinado vencido       | Novos links negados quando necessário; TTL de 60 segundos respeitado                 |
| Listas, seletores pesquisáveis, histórico, mobile e teclado com sessão real          | Fluxo completo utilizável e acessibilidade revisada, sem overflow                    |

Não há credenciais nem Docker/CLI Supabase disponíveis. SQL/concorrência/RLS foram testados com PostgreSQL 18.4 real isolado e shim Auth/Storage. Sharp processa conteúdo real nos testes unitários; serviços/SDK são simulados somente nos testes. E2E atual verifica rotas fechadas e API sem configuração. **CRUD pela interface autenticada, HTTP PostgREST/Storage, signed URL real, pgTAP/PostgreSQL 17 e tipos gerados permanecem pendentes** da matriz acima. Não alegar que os testes locais homologam essas integrações.

## REST entregue

OpenAPI em `api/openapi.yaml` e `api/registry.openapi.yaml`; parâmetros e schemas correspondem à validação Zod em `src/lib/registry/schema.ts`.

| Método | Caminho                         | Comportamento                                                                 |
| ------ | ------------------------------- | ----------------------------------------------------------------------------- |
| GET    | `/api/v1/admin/{resource}`      | Lista paginada; resource = categories, vehicles, customers, drivers, branches |
| POST   | Mesmo                           | Criar com os campos do recurso                                                |
| GET    | `/api/v1/admin/{resource}/{id}` | Detalhe e updated_at exato                                                    |
| PATCH  | Mesmo                           | `{revision, values}` com campos completos, ou `{revision, restore:true}`      |
| DELETE | Mesmo                           | `{revision}`; arquivamento lógico                                             |

Escritas exigem Origin canônico, sessão e permissão; corpo JSON até 64 KiB. Endereços de cliente/unidade entram no nível raiz, como os formulários, e são persistidos em `address`. Erros não incluem SQL ou dados pessoais. Arquivos usam Server Actions próprias com os mesmos guards; não foi criado endpoint REST multipart separado.

Fontes primárias: [DV do CNPJ alfanumérico, Receita](https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/documentos-tecnicos/cnpj), [Storage/RLS](https://supabase.com/docs/guides/storage/security/access-control), [downloads](https://supabase.com/docs/guides/storage/serving/downloads), [Sharp: limites de entrada](https://sharp.pixelplumbing.com/api-constructor/) e [remoção de metadados na saída](https://sharp.pixelplumbing.com/api-output/).
