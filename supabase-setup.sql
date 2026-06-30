-- =====================================================
-- ISRAELITA PIZZAS - Supabase Setup
-- Execute este SQL no SQL Editor do Supabase Dashboard
-- =====================================================

-- Tabela de usuários
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL DEFAULT '',
  email TEXT UNIQUE NOT NULL,
  senha TEXT NOT NULL DEFAULT '',
  telefone TEXT DEFAULT '',
  endereco TEXT DEFAULT '',
  google_id TEXT UNIQUE DEFAULT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT UNIQUE DEFAULT NULL;

-- Tabela do cardápio
CREATE TABLE IF NOT EXISTS menu (
  id SERIAL PRIMARY KEY,
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

-- Tabela de pedidos
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
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

-- Tabela de carrinhos
CREATE TABLE IF NOT EXISTS carts (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  itens JSONB DEFAULT '[]',
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Seed do cardápio
INSERT INTO menu (id, nome, descricao, preco, categoria, imagem, tipo, "maxSabores", classificacao, preco_tradicional, preco_especial, preco_nobre) VALUES
(1, 'Mussarela', 'Molho de tomate, mussarela, orégano', NULL, 'Pizzas Salgadas', '', 'sabor', NULL, 'tradicional', NULL, NULL, NULL),
(2, 'Calabresa', 'Molho de tomate, calabresa, cebola, mussarela', NULL, 'Pizzas Salgadas', '', 'sabor', NULL, 'tradicional', NULL, NULL, NULL),
(3, 'Portuguesa', 'Molho de tomate, presunto, mussarela, ovos, cebola, pimentão, ervilha', NULL, 'Pizzas Salgadas', '', 'sabor', NULL, 'especial', NULL, NULL, NULL),
(4, 'Frango com Catupiry', 'Molho de tomate, frango desfiado, catupiry, mussarela', NULL, 'Pizzas Salgadas', '', 'sabor', NULL, 'especial', NULL, NULL, NULL),
(5, 'Brigadeiro', 'Chocolate ao leite, granulado, leite condensado', NULL, 'Pizzas Doces', '', 'sabor', NULL, 'nobre', NULL, NULL, NULL),
(6, 'Coca-Cola 2L', 'Refrigerante Coca-Cola 2 litros', 12.00, 'Bebidas', '', 'produto', NULL, NULL, NULL, NULL, NULL),
(7, 'Guaraná Antarctica 2L', 'Refrigerante Guaraná Antarctica 2 litros', 10.00, 'Bebidas', '', 'produto', NULL, NULL, NULL, NULL, NULL),
(8, 'Broto', 'Pizza broto (1 sabor)', NULL, 'Tamanhos de Pizza', '', 'tamanho', 1, NULL, 25.90, 29.90, 34.90),
(9, 'Média', 'Pizza média (1 sabor)', NULL, 'Tamanhos de Pizza', '', 'tamanho', 1, NULL, 38.00, 44.00, 50.00),
(10, 'Grande', 'Pizza grande (até 2 sabores)', NULL, 'Tamanhos de Pizza', '', 'tamanho', 2, NULL, 48.00, 55.00, 62.00),
(11, 'Big', 'Pizza big (até 3 sabores)', NULL, 'Tamanhos de Pizza', '', 'tamanho', 3, NULL, 58.00, 66.00, 75.00),
(12, 'Gigante', 'Pizza gigante (até 4 sabores)', NULL, 'Tamanhos de Pizza', '', 'tamanho', 4, NULL, 68.00, 78.00, 88.00)
ON CONFLICT (id) DO NOTHING;

-- Ajusta a sequência para o próximo ID disponível
SELECT setval('menu_id_seq', COALESCE((SELECT MAX(id) FROM menu), 1));

-- Permite acesso com a chave anon (sem autenticação)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon insert users" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "anon select users" ON users FOR SELECT USING (true);
CREATE POLICY "anon all menu" ON menu FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon all orders" ON orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon all carts" ON carts FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "anon all app_config" ON app_config FOR ALL USING (true) WITH CHECK (true);

-- Tabela de configuração da pizzaria
CREATE TABLE IF NOT EXISTS app_config (
  id SERIAL PRIMARY KEY,
  chave TEXT UNIQUE NOT NULL,
  valor JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO app_config (chave, valor) VALUES ('pizzaria', '{
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
ON CONFLICT (chave) DO NOTHING;
