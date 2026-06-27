-- =====================================================
-- ISRAELITA PIZZAS - Supabase Setup
-- Execute este SQL no SQL Editor do Supabase Dashboard
-- =====================================================

-- Tabela do cardápio
CREATE TABLE IF NOT EXISTS menu (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL DEFAULT '',
  descricao TEXT DEFAULT '',
  preco REAL NOT NULL DEFAULT 0,
  categoria TEXT DEFAULT '',
  imagem TEXT DEFAULT '',
  tipo TEXT DEFAULT 'produto',
  "maxSabores" INTEGER
);

-- Tabela de pedidos
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  data TEXT NOT NULL DEFAULT '',
  status TEXT DEFAULT 'pendente',
  "updatedAt" TEXT NOT NULL DEFAULT '',
  cliente JSONB DEFAULT '{}',
  itens JSONB DEFAULT '[]',
  total REAL DEFAULT 0
);

-- Seed do cardápio
INSERT INTO menu (id, nome, descricao, preco, categoria, imagem, tipo, "maxSabores") VALUES
(1, 'Mussarela', 'Molho de tomate, mussarela, orégano', 35.90, 'Pizzas Salgadas', '', 'sabor', NULL),
(2, 'Calabresa', 'Molho de tomate, calabresa, cebola, mussarela', 38.90, 'Pizzas Salgadas', '', 'sabor', NULL),
(3, 'Portuguesa', 'Molho de tomate, presunto, mussarela, ovos, cebola, pimentão, ervilha', 42.90, 'Pizzas Salgadas', '', 'sabor', NULL),
(4, 'Frango com Catupiry', 'Molho de tomate, frango desfiado, catupiry, mussarela', 44.90, 'Pizzas Salgadas', '', 'sabor', NULL),
(5, 'Brigadeiro', 'Chocolate ao leite, granulado, leite condensado', 39.90, 'Pizzas Doces', '', 'sabor', NULL),
(6, 'Coca-Cola 2L', 'Refrigerante Coca-Cola 2 litros', 12.00, 'Bebidas', '', 'produto', NULL),
(7, 'Guaraná Antarctica 2L', 'Refrigerante Guaraná Antarctica 2 litros', 10.00, 'Bebidas', '', 'produto', NULL),
(8, 'Broto', 'Pizza broto (1 sabor)', 25.90, 'Tamanhos de Pizza', '', 'tamanho', 1),
(9, 'Média', 'Pizza média (1 sabor)', 38.00, 'Tamanhos de Pizza', '', 'tamanho', 1),
(10, 'Grande', 'Pizza grande (até 2 sabores)', 48.00, 'Tamanhos de Pizza', '', 'tamanho', 2),
(11, 'Big', 'Pizza big (até 3 sabores)', 58.00, 'Tamanhos de Pizza', '', 'tamanho', 3),
(12, 'Gigante', 'Pizza gigante (até 4 sabores)', 68.00, 'Tamanhos de Pizza', '', 'tamanho', 4)
ON CONFLICT (id) DO NOTHING;

-- Ajusta a sequência para o próximo ID disponível
SELECT setval('menu_id_seq', COALESCE((SELECT MAX(id) FROM menu), 1));

-- Permite acesso com a chave anon (sem autenticação)
ALTER TABLE menu ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon all menu" ON menu FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon all orders" ON orders FOR ALL USING (true) WITH CHECK (true);
