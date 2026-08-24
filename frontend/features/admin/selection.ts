export function selectAvailableItemId<T extends { id: string }>(
  items: readonly T[],
  currentId: string,
) {
  return items.some((item) => item.id === currentId)
    ? currentId
    : (items[0]?.id ?? "");
}
