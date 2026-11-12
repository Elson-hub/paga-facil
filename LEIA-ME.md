# Paga Fácil — como colocar no ar (entrega 1)

Faça os passos uma única vez. Troque `SEUUSUARIO` pelo seu usuário do GitHub.

## 1. Banco de dados (Supabase)

1. Abra o projeto no Supabase → **SQL Editor** → **New query**.
2. Abra o arquivo `supabase/001_banco_inicial.sql`, copie tudo, cole e clique em **Run**.
   Deve aparecer "Success. No rows returned".
3. Vá em **Authentication → URL Configuration**:
   - **Site URL:** `https://SEUUSUARIO.github.io/paga-facil/`
   - **Redirect URLs:** adicione `https://SEUUSUARIO.github.io/paga-facil/` e `http://localhost:5173/paga-facil/`

## 2. Repositório (GitHub)

1. Em github.com, clique em **New repository**.
2. Nome: `paga-facil`. Visibilidade: **Public** (o GitHub Pages gratuito exige repositório público).
   Não marque README nem .gitignore.
3. No repositório criado: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## 3. Enviar o código (no seu computador)

Abra o terminal (Prompt de Comando) dentro da pasta `paga-facil` e rode.
As duas primeiras linhas colocam o arquivo de publicação automática no lugar que o GitHub espera.

```
mkdir .github\workflows
move publicar.yml .github\workflows\
npm install
git init
git add .
git commit -m "Entrega 1: base, login, menu e aparência"
git branch -M main
git remote add origin https://github.com/SEUUSUARIO/paga-facil.git
git push -u origin main
```

Para testar no computador antes de publicar: `npm run dev` e abra o endereço que aparecer.

## 4. Abrir o app

- Aguarde cerca de 2 minutos (acompanhe em **Actions** no GitHub) e abra
  `https://SEUUSUARIO.github.io/paga-facil/`
- **iPhone:** abra o endereço no Safari → botão Compartilhar → **Adicionar à Tela de Início**.

## Daqui para frente

A cada nova entrega: copiar os arquivos atualizados, depois

```
git add .
git commit -m "Entrega N"
git push
```

O GitHub publica sozinho.

## O que tem nesta entrega

- Login, criar conta (com confirmação por e-mail), esqueci minha senha e nova senha
- Menu lateral (fixo no computador, deslizante no celular)
- Home com régua de saldos, pendentes e visão geral (calculada a partir de contas, receitas e despesas)
- Botão + com as quatro opções (as telas de lançamento chegam na entrega 3)
- Ferramentas → Aparência: 4 cores e modo claro, escuro ou automático, salvos no perfil
- Minha conta: nome, troca de senha e sair
- Banco de dados completo da fase 1, com segurança por usuário e categorias padrão
