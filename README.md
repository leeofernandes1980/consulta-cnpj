# Consulta CNPJ

Aplicação web para consultar dados públicos de empresas por CNPJ, buscar por nome de sócio/empresa no histórico local e localizar empresas pelo CPF/CNPJ de um sócio.

## Funcionalidades

- **Consulta por CNPJ** com fallback automático entre três fontes gratuitas: [CNPJ.ws](https://cnpj.ws), [Minha Receita](https://minhareceita.org) e [BrasilAPI](https://brasilapi.com.br).
- **Busca em lote** de vários CNPJs de uma vez.
- **Busca por sócio**: nome (no histórico local) ou CPF/CNPJ (via Minha Receita, com filtro de UF).
- **Histórico local**: empresas consultadas ficam salvas no navegador (`localStorage`), com detecção de entradas antigas/expiradas.
- **Exportação** do histórico em CSV e JSON.

## Rodando localmente

```bash
npm install
npm run dev
```

Abre em `http://localhost:5173`.

Outros comandos:

```bash
npm run build    # build de producao
npm run preview  # preview do build
npm run lint      # eslint
```

## Deploy

Projeto pronto para deploy na [Vercel](https://vercel.com) (detecta Vite automaticamente).

O acesso é protegido por autenticação HTTP Basic via Edge Middleware ([middleware.js](middleware.js)). Configure estas variáveis de ambiente no painel da Vercel antes do deploy:

| Variável | Descrição |
|---|---|
| `BASIC_AUTH_USER` | usuário para acessar a aplicação |
| `BASIC_AUTH_PASSWORD` | senha para acessar a aplicação |

## Stack

React + Vite, Tailwind CSS. Sem backend próprio — todas as consultas são feitas direto do navegador para APIs públicas gratuitas, sem chaves de API.

## Privacidade

O CPF de sócios pessoa física é exibido parcialmente mascarado (`***XXXXXX**`), conforme publicado pela Receita Federal. O histórico de consultas fica salvo apenas no navegador de cada usuário, não é compartilhado.
