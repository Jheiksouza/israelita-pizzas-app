-- =====================================================
-- QUERO PIZZA - Supabase Setup (multi-tenant)
-- Execute no SQL Editor do Supabase Dashboard
-- =====================================================

-- 1. TABELA DE LOJAS (stores)
CREATE TABLE IF NOT EXISTS stores (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL DEFAULT '',
  owner_id INTEGER,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Seed: Israelita (primeiro cliente, slug = israelita)
INSERT INTO stores (id, slug, nome, config) VALUES
(1, 'israelita', 'Pizzaria Israelita', '{
  "cnpj": "",
  "nome_fantasia": "Israelita Pizzas",
  "razao_social": "",
  "telefone": "(41) 99999-9999",
  "cep": "82840-080",
  "rua": "Rua Eloir Dide Maria",
  "numero": "283",
  "complemento": "",
  "bairro": "Tatuquara",
  "cidade": "Curitiba",
  "estado": "PR",
  "lat": -25.590233,
  "lng": -49.321738
}')
ON CONFLICT (id) DO NOTHING;

-- 2. ADICIONAR store_id NAS TABELAS EXISTENTES
ALTER TABLE users ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES stores(id);
ALTER TABLE menu ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES stores(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES stores(id);
ALTER TABLE carts ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES stores(id);
ALTER TABLE app_config ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES stores(id);

-- 3. ATRIBUIR DADOS EXISTENTES À ISRAELITA (store_id = 1)
UPDATE users SET store_id = 1 WHERE store_id IS NULL;
UPDATE menu SET store_id = 1 WHERE store_id IS NULL;
UPDATE orders SET store_id = 1 WHERE store_id IS NULL;
UPDATE carts SET store_id = 1 WHERE store_id IS NULL;
UPDATE app_config SET store_id = 1 WHERE store_id IS NULL AND chave != 'fcm_tokens';
-- fcm_tokens é global (store_id NULL)

-- 4. REMOVER UNIQUE antigo e recriar composto (store_id, email)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;
ALTER TABLE users ADD CONSTRAINT users_store_email UNIQUE (store_id, email);
-- google_id continua global
ALTER TABLE users ADD CONSTRAINT users_google_id_key UNIQUE (google_id);

-- 5. app_config: chave deixa de ser global, vira (store_id, chave)
-- Remove unique antigo (se existir) e adiciona composto
-- Mantém suporte a chaves globais (store_id = NULL)
DROP INDEX IF EXISTS app_config_chave_key;
ALTER TABLE app_config DROP CONSTRAINT IF EXISTS app_config_chave_key;
CREATE UNIQUE INDEX IF NOT EXISTS app_config_store_chave ON app_config (COALESCE(store_id, -1), chave);

-- 6. Tabela de usuários
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  store_id INTEGER REFERENCES stores(id),
  nome TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  senha TEXT NOT NULL DEFAULT '',
  telefone TEXT DEFAULT '',
  endereco TEXT DEFAULT '',
  enderecos JSONB DEFAULT '[]',
  enderecoselecionado TEXT DEFAULT NULL,
  google_id TEXT UNIQUE DEFAULT NULL,
  role TEXT DEFAULT 'cliente',
  status TEXT DEFAULT 'ativo',
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT users_store_email UNIQUE (store_id, email)
);

-- Backfill columns that may not exist in older schemas
ALTER TABLE users ADD COLUMN IF NOT EXISTS enderecos JSONB DEFAULT '[]';
ALTER TABLE users ADD COLUMN IF NOT EXISTS enderecoselecionado TEXT DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'cliente';
ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ativo';

-- 7. Tabela do cardápio
CREATE TABLE IF NOT EXISTS menu (
  id SERIAL PRIMARY KEY,
  store_id INTEGER REFERENCES stores(id),
  nome TEXT NOT NULL DEFAULT '',
  descricao TEXT DEFAULT '',
  preco REAL,
  categoria TEXT DEFAULT '',
  imagem TEXT DEFAULT '',
  tipo TEXT DEFAULT 'produto',
  "maxSabores" INTEGER,
  classificacao TEXT DEFAULT '',
  preco_tradicional REAL,
  preco_especial REAL,
  preco_nobre REAL
);

-- 8. Tabela de pedidos
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  store_id INTEGER REFERENCES stores(id),
  data TEXT NOT NULL DEFAULT '',
  status TEXT DEFAULT 'pendente',
  "updatedAt" TEXT NOT NULL DEFAULT '',
  cliente JSONB DEFAULT '{}',
  itens JSONB DEFAULT '[]',
  total REAL DEFAULT 0,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  entrega_lat DOUBLE PRECISION,
  entrega_lng DOUBLE PRECISION
);

-- 9. Tabela de carrinhos
CREATE TABLE IF NOT EXISTS carts (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  store_id INTEGER REFERENCES stores(id),
  itens JSONB DEFAULT '[]',
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 10. Tabela de configuração (agora com store_id)
CREATE TABLE IF NOT EXISTS app_config (
  id SERIAL PRIMARY KEY,
  store_id INTEGER REFERENCES stores(id),
  chave TEXT NOT NULL,
  valor JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS app_config_store_chave ON app_config (COALESCE(store_id, -1), chave);

-- 11. Seed do cardápio da Israelita (store_id = 1)
INSERT INTO menu (store_id, id, nome, descricao, preco, categoria, imagem, tipo, "maxSabores", classificacao, preco_tradicional, preco_especial, preco_nobre) VALUES
(1, 1, 'Mussarela', 'Molho de tomate, mussarela, orégano', NULL, 'Pizzas Salgadas', '', 'sabor', NULL, 'tradicional', NULL, NULL, NULL),
(1, 2, 'Calabresa', 'Molho de tomate, calabresa, cebola, mussarela', NULL, 'Pizzas Salgadas', '', 'sabor', NULL, 'tradicional', NULL, NULL, NULL),
(1, 3, 'Portuguesa', 'Molho de tomate, presunto, mussarela, ovos, cebola, pimentão, ervilha', NULL, 'Pizzas Salgadas', '', 'sabor', NULL, 'especial', NULL, NULL, NULL),
(1, 4, 'Frango com Catupiry', 'Molho de tomate, frango desfiado, catupiry, mussarela', NULL, 'Pizzas Salgadas', '', 'sabor', NULL, 'especial', NULL, NULL, NULL),
(1, 5, 'Brigadeiro', 'Chocolate ao leite, granulado, leite condensado', NULL, 'Pizzas Doces', '', 'sabor', NULL, 'nobre', NULL, NULL, NULL),
(1, 6, 'Coca-Cola 2L', 'Refrigerante Coca-Cola 2 litros', 12.00, 'Bebidas', '', 'produto', NULL, NULL, NULL, NULL, NULL),
(1, 7, 'Guaraná Antarctica 2L', 'Refrigerante Guaraná Antarctica 2 litros', 10.00, 'Bebidas', '', 'produto', NULL, NULL, NULL, NULL, NULL),
(1, 8, 'Broto', 'Pizza broto (1 sabor)', NULL, 'Tamanhos de Pizza', '', 'tamanho', 1, NULL, 25.90, 29.90, 34.90),
(1, 9, 'Média', 'Pizza média (1 sabor)', NULL, 'Tamanhos de Pizza', '', 'tamanho', 1, NULL, 38.00, 44.00, 50.00),
(1, 10, 'Grande', 'Pizza grande (até 2 sabores)', NULL, 'Tamanhos de Pizza', '', 'tamanho', 2, NULL, 48.00, 55.00, 62.00),
(1, 11, 'Big', 'Pizza big (até 3 sabores)', NULL, 'Tamanhos de Pizza', '', 'tamanho', 3, NULL, 58.00, 66.00, 75.00),
(1, 12, 'Gigante', 'Pizza gigante (até 4 sabores)', NULL, 'Tamanhos de Pizza', '', 'tamanho', 4, NULL, 68.00, 78.00, 88.00)
ON CONFLICT (id) DO NOTHING;

SELECT setval('menu_id_seq', COALESCE((SELECT MAX(id) FROM menu), 1));

-- 12. RLS (Row Level Security)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Drop policies antigas e recria
DROP POLICY IF EXISTS "anon insert users" ON users;
DROP POLICY IF EXISTS "anon select users" ON users;
DROP POLICY IF EXISTS "anon all menu" ON menu;
DROP POLICY IF EXISTS "anon all orders" ON orders;
DROP POLICY IF EXISTS "anon all carts" ON carts;
DROP POLICY IF EXISTS "anon all app_config" ON app_config;

CREATE POLICY "anon insert users" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "anon select users" ON users FOR SELECT USING (true);
CREATE POLICY "anon all menu" ON menu FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon all orders" ON orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon all carts" ON carts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon all app_config" ON app_config FOR ALL USING (true) WITH CHECK (true);
