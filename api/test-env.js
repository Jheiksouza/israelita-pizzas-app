module.exports = (req, res) => {
  res.json({
    url: process.env.SUPABASE_URL || 'NAO DEFINIDA',
    key: process.env.SUPABASE_ANON_KEY ? 'DEFINIDA' : 'NAO DEFINIDA',
    vercel: process.env.VERCEL || 'nao'
  })
}
