const noCache = handler => (req, res, ...args) => {
  res.setHeader(`Pragma-directive`, `no-cache`)
  res.setHeader(`Cache-directive`, `no-cache`)
  res.setHeader(`Cache-control`, `no-cache`)
  res.setHeader(`Pragma`, `no-cache, no-store, must-revalidate`)
  res.setHeader(`Expires`, 0)
  handler(req, res, ...args)
}

export default noCache
