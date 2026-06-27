module.exports = (req, res) => {
  res.json({
    status: 'ok',
    supabaseUrl: !!process.env.SUPABASE_URL,
    supabaseKey: !!process.env.SUPABASE_ANON_KEY
  })
}
