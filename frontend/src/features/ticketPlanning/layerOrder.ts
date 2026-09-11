const MAX_LAYER_ORDER = 2147483647

export const nextLayerOrder = (items: Array<{ z?: number | string }> = []) => {
  const current = items.reduce((highest, item) => {
    const value = Number(item.z)
    return Number.isFinite(value) && value >= 0 && value <= MAX_LAYER_ORDER
      ? Math.max(highest, Math.floor(value))
      : highest
  }, 0)
  return Math.min(current + 1, MAX_LAYER_ORDER)
}
