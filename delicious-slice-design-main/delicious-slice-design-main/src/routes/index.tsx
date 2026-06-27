import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import heroPizza from "@/assets/hero-pizza.jpg";
import imgMargherita from "@/assets/pizza-margherita.jpg";
import imgCalabresa from "@/assets/pizza-calabresa.jpg";
import imgQuatro from "@/assets/pizza-quatro-queijos.jpg";
import imgPortuguesa from "@/assets/pizza-portuguesa.jpg";
import imgChocolate from "@/assets/pizza-chocolate.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Israelita Pizza — Forno a lenha artesanal" },
      { name: "description", content: "Monte sua pizza artesanal: tamanhos, sabores tradicionais, especiais e nobres. Entrega rápida." },
    ],
  }),
  component: Index,
});

type Classificacao = "tradicional" | "especial" | "nobre";
type Sabor = { id: number; nome: string; desc: string; classificacao: Classificacao; img: string };
type Tamanho = { id: string; nome: string; fatias: string; maxSabores: number; tradicional: number; especial: number; nobre: number };

const TAMANHOS: Tamanho[] = [
  { id: "broto", nome: "Broto", fatias: "4 fatias · 25cm", maxSabores: 1, tradicional: 32, especial: 38, nobre: 44 },
  { id: "media", nome: "Média", fatias: "6 fatias · 30cm", maxSabores: 2, tradicional: 48, especial: 56, nobre: 64 },
  { id: "grande", nome: "Grande", fatias: "8 fatias · 35cm", maxSabores: 3, tradicional: 62, especial: 72, nobre: 84 },
  { id: "familia", nome: "Família", fatias: "12 fatias · 45cm", maxSabores: 4, tradicional: 84, especial: 96, nobre: 110 },
];

const SABORES: Sabor[] = [
  { id: 1, nome: "Margherita", desc: "Molho San Marzano, mozzarella di bufala, manjericão fresco", classificacao: "tradicional", img: imgMargherita },
  { id: 2, nome: "Calabresa Artesanal", desc: "Calabresa defumada, cebola roxa, azeitona preta", classificacao: "tradicional", img: imgCalabresa },
  { id: 3, nome: "Quatro Queijos", desc: "Mozzarella, parmesão, gorgonzola, provolone defumado", classificacao: "especial", img: imgQuatro },
  { id: 4, nome: "Portuguesa", desc: "Presunto Parma, ovos caipiras, cebola, ervilha, azeitona", classificacao: "especial", img: imgPortuguesa },
  { id: 5, nome: "Trufa Nobre", desc: "Creme de trufa negra, mozzarella, parmesão envelhecido, rúcula", classificacao: "nobre", img: imgQuatro },
  { id: 6, nome: "Pernil & Brie", desc: "Pernil desfiado, brie cremoso, geleia de damasco, mel", classificacao: "nobre", img: imgPortuguesa },
  { id: 7, nome: "Chocolate Belga", desc: "Ganache de chocolate 70%, morangos frescos, raspas de cacau", classificacao: "especial", img: imgChocolate },
  { id: 8, nome: "Pepperoni", desc: "Pepperoni curado, mozzarella fior di latte, orégano", classificacao: "tradicional", img: imgCalabresa },
];

const BEBIDAS = [
  { id: "b1", nome: "Vinho Tinto da Casa", desc: "Cabernet Sauvignon, taça 150ml", preco: 28, emoji: "🍷" },
  { id: "b2", nome: "Cerveja Artesanal IPA", desc: "Long neck 355ml, lúpulo cítrico", preco: 18, emoji: "🍺" },
  { id: "b3", nome: "Água com Gás", desc: "San Pellegrino 500ml", preco: 12, emoji: "💧" },
  { id: "b4", nome: "Suco Natural", desc: "Laranja, limão ou abacaxi, 400ml", preco: 14, emoji: "🍊" },
];

function Index() {
  const [tamanhoSel, setTamanhoSel] = useState<Tamanho | null>(TAMANHOS[2]);
  const [saboresSel, setSaboresSel] = useState<Sabor[]>([]);
  const [filtro, setFiltro] = useState<"todos" | Classificacao>("todos");
  const [busca, setBusca] = useState("");
  const [carrinho, setCarrinho] = useState<{ key: string; nome: string; preco: number; qtd: number; detalhe?: string }[]>([]);
  const [cartOpen, setCartOpen] = useState(false);

  const saboresFiltrados = SABORES.filter(s =>
    (filtro === "todos" || s.classificacao === filtro) &&
    (busca === "" || s.nome.toLowerCase().includes(busca.toLowerCase()))
  );

  const precoPizza = useMemo(() => {
    if (!tamanhoSel || saboresSel.length === 0) return 0;
    const precos = saboresSel.map(s => tamanhoSel[s.classificacao]);
    return Math.max(...precos);
  }, [tamanhoSel, saboresSel]);

  const toggleSabor = (s: Sabor) => {
    if (!tamanhoSel) return;
    if (saboresSel.find(x => x.id === s.id)) {
      setSaboresSel(saboresSel.filter(x => x.id !== s.id));
    } else if (saboresSel.length < tamanhoSel.maxSabores) {
      setSaboresSel([...saboresSel, s]);
    }
  };

  const adicionarPizza = () => {
    if (!tamanhoSel || saboresSel.length === 0) return;
    const detalhe = `${saboresSel.map(s => s.nome).join(" · ")}`;
    setCarrinho([...carrinho, {
      key: `pizza-${Date.now()}`,
      nome: `Pizza ${tamanhoSel.nome}`,
      preco: precoPizza,
      qtd: 1,
      detalhe,
    }]);
    setSaboresSel([]);
    setCartOpen(true);
  };

  const adicionarBebida = (b: typeof BEBIDAS[number]) => {
    const existing = carrinho.find(c => c.key === b.id);
    if (existing) {
      setCarrinho(carrinho.map(c => c.key === b.id ? { ...c, qtd: c.qtd + 1 } : c));
    } else {
      setCarrinho([...carrinho, { key: b.id, nome: b.nome, preco: b.preco, qtd: 1 }]);
    }
  };

  const total = carrinho.reduce((acc, i) => acc + i.preco * i.qtd, 0);
  const totalItens = carrinho.reduce((acc, i) => acc + i.qtd, 0);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Background decoration */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 size-[600px] rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute top-1/3 -right-40 size-[500px] rounded-full bg-accent/10 blur-3xl" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <a href="#" className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-full bg-gradient-to-br from-primary to-ember shadow-glow">
              <span className="text-xl">🍕</span>
            </div>
            <div className="leading-tight">
              <p className="text-display text-xl font-bold text-cream">Israelita</p>
              <p className="-mt-1 text-[10px] uppercase tracking-[0.3em] text-accent">Pizza · forno a lenha</p>
            </div>
          </a>
          <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
            <a href="#montar" className="transition hover:text-cream">Monte sua pizza</a>
            <a href="#sabores" className="transition hover:text-cream">Sabores</a>
            <a href="#bebidas" className="transition hover:text-cream">Bebidas</a>
          </nav>
          <button
            onClick={() => setCartOpen(true)}
            className="relative flex items-center gap-2 rounded-full bg-card px-4 py-2.5 text-sm font-medium text-cream shadow-card transition hover:bg-secondary"
          >
            <span>🛒</span>
            <span className="hidden sm:inline">Carrinho</span>
            {totalItens > 0 && (
              <span className="grid size-6 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{totalItens}</span>
            )}
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroPizza} alt="" width={1920} height={1280} className="size-full object-cover opacity-50" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/40 to-background" />
        </div>
        <div className="relative mx-auto grid max-w-7xl gap-12 px-6 py-20 md:py-32 lg:grid-cols-2 lg:items-center">
          <div className="animate-fade-up">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-1.5 text-xs uppercase tracking-[0.3em] text-accent">
              <span className="size-1.5 rounded-full bg-accent animate-pulse" /> Aberto agora · 35min
            </div>
            <h1 className="text-display text-5xl font-bold leading-[0.95] text-cream md:text-7xl lg:text-8xl">
              A pizza<br />
              <span className="italic text-primary">artesanal</span><br />
              de Israel.
            </h1>
            <p className="mt-6 max-w-md text-lg text-muted-foreground">
              Massa de fermentação natural por 48h, ingredientes selecionados e o sabor único do forno a lenha.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <a href="#montar" className="rounded-full bg-primary px-7 py-4 text-sm font-semibold uppercase tracking-wider text-primary-foreground shadow-warm transition hover:scale-[1.02] hover:bg-ember">
                Monte sua pizza →
              </a>
              <a href="#sabores" className="rounded-full border border-border bg-card/50 px-7 py-4 text-sm font-medium text-cream backdrop-blur transition hover:bg-card">
                Ver cardápio
              </a>
            </div>
            <div className="mt-12 flex gap-8 text-sm">
              <Stat n="48h" label="Fermentação natural" />
              <Stat n="450°" label="Forno a lenha" />
              <Stat n="4.9" label="★ avaliação" />
            </div>
          </div>
          <div className="relative hidden lg:block">
            <div className="absolute inset-0 -m-10 rounded-full bg-gradient-to-tr from-primary/30 to-accent/20 blur-3xl" />
            <div className="relative animate-float">
              <img src={heroPizza} alt="Pizza artesanal Israelita" width={800} height={800} className="aspect-square rounded-full object-cover shadow-warm ring-1 ring-accent/30" />
              <div className="absolute -bottom-6 -left-6 rounded-2xl bg-card/90 px-5 py-4 shadow-card backdrop-blur">
                <p className="text-xs uppercase tracking-widest text-accent">desde 2008</p>
                <p className="text-display text-lg font-semibold text-cream">Receita da nonna</p>
              </div>
              <div className="absolute -right-4 top-8 rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-glow">
                R$ 48 · Margherita
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pizza Builder */}
      <section id="montar" className="relative mx-auto max-w-7xl px-6 py-24">
        <div className="mb-12 text-center">
          <p className="mb-3 text-xs uppercase tracking-[0.4em] text-accent">A experiência</p>
          <h2 className="text-display text-4xl font-bold text-cream md:text-6xl">Monte sua pizza</h2>
          <p className="mt-4 text-muted-foreground">Três passos. Mil combinações possíveis.</p>
        </div>

        {/* Step 1: Tamanhos */}
        <Step n={1} title="Escolha o tamanho" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TAMANHOS.map(t => {
            const active = tamanhoSel?.id === t.id;
            return (
              <button
                key={t.id}
                onClick={() => { setTamanhoSel(t); if (saboresSel.length > t.maxSabores) setSaboresSel(saboresSel.slice(0, t.maxSabores)); }}
                className={`group relative overflow-hidden rounded-2xl border p-6 text-left transition-all ${
                  active
                    ? "border-primary bg-gradient-to-br from-card to-secondary shadow-warm scale-[1.02]"
                    : "border-border bg-card hover:border-accent/50 hover:bg-secondary"
                }`}
              >
                <div className={`absolute -right-8 -top-8 size-24 rounded-full transition ${active ? "bg-primary/20" : "bg-muted/40 group-hover:bg-accent/10"}`} />
                <div className="relative">
                  <div className="mb-4 flex items-center justify-between">
                    <span className={`text-display text-2xl font-bold ${active ? "text-cream" : "text-cream"}`}>{t.nome}</span>
                    {active && <span className="grid size-7 place-items-center rounded-full bg-primary text-xs text-primary-foreground">✓</span>}
                  </div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">{t.fatias}</p>
                  <p className="mt-1 text-xs text-accent">até {t.maxSabores} {t.maxSabores === 1 ? "sabor" : "sabores"}</p>
                  <div className="mt-5 flex items-baseline gap-1">
                    <span className="text-xs text-muted-foreground">a partir de</span>
                  </div>
                  <p className="text-display text-3xl font-bold text-primary">R$ {t.tradicional}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Step 2: Sabores */}
        <div className="mt-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <Step n={2} title="Escolha os sabores" inline />
            {tamanhoSel && (
              <div className="text-sm text-muted-foreground">
                <span className="font-semibold text-cream">{saboresSel.length}</span> / {tamanhoSel.maxSabores} sabores
              </div>
            )}
          </div>

          {/* Filters + search */}
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap gap-2">
              {(["todos", "tradicional", "especial", "nobre"] as const).map(c => (
                <button
                  key={c}
                  onClick={() => setFiltro(c)}
                  className={`rounded-full px-4 py-2 text-xs font-medium uppercase tracking-wider transition ${
                    filtro === c
                      ? "bg-accent text-accent-foreground"
                      : "bg-card text-muted-foreground hover:bg-secondary hover:text-cream"
                  }`}
                >
                  {c === "todos" ? "Todos" : c}
                </button>
              ))}
            </div>
            <div className="relative ml-auto w-full sm:w-64">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">⌕</span>
              <input
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Buscar sabor..."
                className="w-full rounded-full border border-border bg-card py-3 pl-10 pr-4 text-sm text-cream placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {saboresFiltrados.map(s => {
              const active = !!saboresSel.find(x => x.id === s.id);
              const disabled = !active && tamanhoSel && saboresSel.length >= tamanhoSel.maxSabores;
              return (
                <button
                  key={s.id}
                  onClick={() => toggleSabor(s)}
                  disabled={!!disabled}
                  className={`group relative overflow-hidden rounded-2xl border text-left transition-all ${
                    active
                      ? "border-primary shadow-warm scale-[1.01]"
                      : disabled
                        ? "border-border opacity-40 cursor-not-allowed"
                        : "border-border bg-card hover:border-accent/40 hover:-translate-y-1"
                  }`}
                >
                  <div className="relative aspect-[4/3] overflow-hidden">
                    <img src={s.img} alt={s.nome} loading="lazy" width={800} height={600} className="size-full object-cover transition duration-700 group-hover:scale-110" />
                    <div className="absolute inset-0 bg-gradient-to-t from-card via-card/30 to-transparent" />
                    <span className={`absolute left-4 top-4 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-widest ${
                      s.classificacao === "nobre" ? "bg-accent text-accent-foreground" :
                      s.classificacao === "especial" ? "bg-primary/90 text-primary-foreground" :
                      "bg-card/80 text-cream backdrop-blur"
                    }`}>
                      {s.classificacao}
                    </span>
                    {active && (
                      <span className="absolute right-4 top-4 grid size-9 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground shadow-glow">
                        ✓
                      </span>
                    )}
                  </div>
                  <div className="p-5">
                    <h3 className="text-display text-xl font-semibold text-cream">{s.nome}</h3>
                    <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{s.desc}</p>
                    {tamanhoSel && (
                      <p className="mt-3 text-sm">
                        <span className="text-muted-foreground">R$ </span>
                        <span className="text-display text-lg font-bold text-primary">{tamanhoSel[s.classificacao]}</span>
                        <span className="text-xs text-muted-foreground"> · {tamanhoSel.nome.toLowerCase()}</span>
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 3: Resumo */}
        <div className="sticky bottom-4 mt-12 rounded-3xl border border-border bg-card/95 p-6 shadow-card backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="grid size-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary/30 to-ember/20 text-3xl">
                🍕
              </div>
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-widest text-accent">Sua pizza</p>
                <p className="text-display text-xl font-bold text-cream">
                  {tamanhoSel ? `${tamanhoSel.nome}` : "Escolha o tamanho"}
                  {saboresSel.length > 0 && <span className="text-muted-foreground"> · {saboresSel.map(s => s.nome).join(" + ")}</span>}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Total</p>
                <p className="text-display text-3xl font-bold text-primary">R$ {precoPizza.toFixed(2)}</p>
              </div>
              <button
                onClick={adicionarPizza}
                disabled={!tamanhoSel || saboresSel.length === 0}
                className="rounded-full bg-primary px-7 py-4 text-sm font-semibold uppercase tracking-wider text-primary-foreground shadow-warm transition hover:bg-ember disabled:cursor-not-allowed disabled:opacity-40"
              >
                Adicionar ao carrinho
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Bebidas */}
      <section id="bebidas" className="mx-auto max-w-7xl px-6 py-24">
        <div className="mb-10 flex items-end justify-between">
          <div>
            <p className="mb-2 text-xs uppercase tracking-[0.4em] text-accent">Acompanha bem</p>
            <h2 className="text-display text-4xl font-bold text-cream md:text-5xl">Bebidas & extras</h2>
          </div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {BEBIDAS.map(b => (
            <div key={b.id} className="group rounded-2xl border border-border bg-card p-6 transition hover:border-accent/40 hover:-translate-y-1">
              <div className="mb-5 grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-secondary to-muted text-3xl">{b.emoji}</div>
              <h3 className="text-display text-xl font-semibold text-cream">{b.nome}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{b.desc}</p>
              <div className="mt-5 flex items-center justify-between">
                <p className="text-display text-2xl font-bold text-primary">R$ {b.preco}</p>
                <button
                  onClick={() => adicionarBebida(b)}
                  className="rounded-full border border-border bg-background px-4 py-2 text-xs font-semibold uppercase tracking-wider text-cream transition hover:border-primary hover:bg-primary hover:text-primary-foreground"
                >
                  Adicionar
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border bg-charcoal/50 py-12">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 text-sm text-muted-foreground">
          <p className="text-display text-lg text-cream">Israelita Pizza</p>
          <p>Forno a lenha · Entrega 35min · Aberto até 23h</p>
          <p>© 2026</p>
        </div>
      </footer>

      {/* Cart drawer */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button aria-label="Fechar" className="absolute inset-0 bg-background/70 backdrop-blur" onClick={() => setCartOpen(false)} />
          <aside className="relative flex h-full w-full max-w-md flex-col bg-card shadow-2xl animate-fade-up">
            <div className="flex items-center justify-between border-b border-border px-6 py-5">
              <div>
                <p className="text-xs uppercase tracking-widest text-accent">Seu carrinho</p>
                <p className="text-display text-2xl font-bold text-cream">{totalItens} {totalItens === 1 ? "item" : "itens"}</p>
              </div>
              <button onClick={() => setCartOpen(false)} className="grid size-10 place-items-center rounded-full bg-secondary text-cream hover:bg-muted">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {carrinho.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <div className="mb-4 grid size-24 place-items-center rounded-full bg-secondary text-5xl">🛒</div>
                  <p className="text-display text-xl text-cream">Carrinho vazio</p>
                  <p className="mt-1 text-sm text-muted-foreground">Que tal montar uma pizza?</p>
                  <button onClick={() => setCartOpen(false)} className="mt-6 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground">
                    Ver cardápio
                  </button>
                </div>
              ) : (
                <ul className="space-y-3">
                  {carrinho.map((item, i) => (
                    <li key={item.key} className="rounded-2xl border border-border bg-background p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-display font-semibold text-cream">{item.nome}</p>
                          {item.detalhe && <p className="mt-1 text-xs text-muted-foreground">{item.detalhe}</p>}
                        </div>
                        <button
                          onClick={() => setCarrinho(carrinho.filter((_, idx) => idx !== i))}
                          className="text-muted-foreground hover:text-destructive"
                          aria-label="Remover"
                        >✕</button>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <div className="flex items-center gap-1 rounded-full bg-card p-1">
                          <button
                            onClick={() => setCarrinho(carrinho.map((c, idx) => idx === i ? { ...c, qtd: Math.max(1, c.qtd - 1) } : c))}
                            className="grid size-8 place-items-center rounded-full text-cream hover:bg-secondary"
                          >−</button>
                          <span className="w-6 text-center text-sm font-semibold text-cream">{item.qtd}</span>
                          <button
                            onClick={() => setCarrinho(carrinho.map((c, idx) => idx === i ? { ...c, qtd: c.qtd + 1 } : c))}
                            className="grid size-8 place-items-center rounded-full text-cream hover:bg-secondary"
                          >+</button>
                        </div>
                        <p className="text-display text-lg font-bold text-primary">R$ {(item.preco * item.qtd).toFixed(2)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {carrinho.length > 0 && (
              <div className="space-y-4 border-t border-border bg-background/50 px-6 py-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Subtotal</span>
                  <span className="text-cream">R$ {total.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Entrega</span>
                  <span className="text-accent">Grátis</span>
                </div>
                <div className="flex items-center justify-between border-t border-border pt-4">
                  <span className="text-display text-lg text-cream">Total</span>
                  <span className="text-display text-3xl font-bold text-primary">R$ {total.toFixed(2)}</span>
                </div>
                <button className="w-full rounded-full bg-primary py-4 text-sm font-semibold uppercase tracking-wider text-primary-foreground shadow-warm transition hover:bg-ember">
                  Finalizar pedido →
                </button>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

function Stat({ n, label }: { n: string; label: string }) {
  return (
    <div>
      <p className="text-display text-2xl font-bold text-cream">{n}</p>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}

function Step({ n, title, inline }: { n: number; title: string; inline?: boolean }) {
  return (
    <div className={`mb-6 flex items-center gap-4 ${inline ? "" : ""}`}>
      <div className="grid size-10 place-items-center rounded-full border border-accent/40 bg-accent/10 text-display text-lg font-bold text-accent">
        {n}
      </div>
      <h3 className="text-display text-2xl font-semibold text-cream md:text-3xl">{title}</h3>
    </div>
  );
}
