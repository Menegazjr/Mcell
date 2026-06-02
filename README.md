# ◆ Mcell — Sistema de Gestão de Vendas

Dashboard profissional para gestão de vendas de loja de iPhones.
**Stack:** HTML/CSS/JS puro + Supabase (banco e auth) + GitHub Pages (hosting gratuito)

-----

## 🚀 Deploy em 5 passos

### 1. Criar projeto no Supabase

1. Acesse [supabase.com](https://supabase.com) e crie uma conta gratuita
1. Clique em **New Project**, dê um nome (ex: `mcell`) e defina uma senha forte
1. Aguarde o projeto ser criado (~1 min)

### 2. Configurar o banco de dados

1. No painel do Supabase, vá em **SQL Editor**
1. Cole o conteúdo do arquivo `supabase-setup.sql` e clique em **Run**
1. Todas as tabelas e políticas de segurança serão criadas

### 3. Pegar as credenciais do Supabase

1. Vá em **Settings → API**
1. Copie a **Project URL** e a **anon public key**
1. Abra o arquivo `supabase-config.js` e substitua:

```js
const SUPABASE_URL = 'https://SEU_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'SUA_ANON_KEY_AQUI';
```

### 4. Publicar no GitHub Pages

1. Crie um repositório no GitHub (ex: `mcell`)
1. Faça upload de **todos** os arquivos desta pasta
1. Vá em **Settings → Pages**
1. Em **Source**, selecione `main` branch e pasta `/ (root)`
1. Clique em **Save** — o site estará em `https://seu-usuario.github.io/mcell`

### 5. Criar o primeiro usuário Admin

1. Acesse o sistema pelo link do GitHub Pages
1. Clique em **Entrar** e cadastre-se com seu e-mail no Supabase:
- Vá em **Authentication → Users → Invite user** no painel Supabase
- Ou use **Sign Up** (se habilitado nas configurações de auth)
1. Após criar a conta, execute no **SQL Editor**:
   
   ```sql
   UPDATE profiles SET role = 'admin'
   WHERE id = 'SEU_USER_ID';
   ```
   
   O User ID aparece em **Authentication → Users**

-----

## 👥 Criando Usuários Vendedoras

1. No Supabase: **Authentication → Users → Invite user**
1. Insira o e-mail da vendedora
1. No SQL Editor, vincule ao perfil:
   
   ```sql
   -- Primeiro encontre o ID da vendedora na tabela vendedoras
   SELECT id, nome FROM vendedoras;
   
   -- Depois atualize o profile com o UUID correto
   UPDATE profiles
   SET role = 'vendedora', vendedora_id = 'UUID_DA_VENDEDORA'
   WHERE id = 'UUID_DO_USER_AUTH';
   ```
1. A vendedora recebe e-mail com link de acesso

-----

## 📁 Estrutura dos Arquivos

```
mcell/
├── index.html          # Estrutura HTML principal
├── style.css           # Design system completo
├── supabase-config.js  # ⚠️ Configurar com suas credenciais!
├── auth.js             # Login, logout, controle de acesso
├── app.js              # Navegação e inicialização
├── dashboard.js        # Dashboard com KPIs e gráficos
├── vendas.js           # Registro de vendas
├── vendedoras.js       # CRUD de vendedoras (admin)
├── metas.js            # Metas mensais (admin)
├── relatorios.js       # Relatórios + exportação PDF/Excel
├── supabase-setup.sql  # Script SQL para criar o banco
└── README.md           # Este arquivo
```

-----

## 🎯 Funcionalidades

|Funcionalidade      |Admin    |Vendedora            |
|--------------------|---------|---------------------|
|Dashboard geral     |✅        |✅ (apenas seus dados)|
|Registrar vendas    |✅        |✅                    |
|Gerenciar vendedoras|✅        |❌                    |
|Definir metas       |✅        |❌                    |
|Ver relatórios      |✅ (todas)|✅ (suas)             |
|Exportar PDF/Excel  |✅        |✅                    |
|Ranking geral       |✅        |❌                    |

-----

## ⚙️ Configurações no Supabase

### Autenticação

- Vá em **Authentication → Providers → Email**
- Habilite **Enable email confirmations** (recomendado)
- Configure **Site URL** com a URL do seu GitHub Pages

### CORS (se necessário)

- Vá em **Settings → API → CORS**
- Adicione `https://seu-usuario.github.io`

-----

## 🛠️ Personalização

### Modelos de iPhone

Edite o array `MODELOS_IPHONE` em `vendas.js` para adicionar novos modelos.

### Cores

Edite as variáveis CSS em `style.css`:

```css
:root {
  --blue: #3d7eff;  /* Cor principal */
  --bg:   #0a0a0f;  /* Fundo escuro */
}
```

-----

**Mcell © 2026** — Sistema desenvolvido com ◆