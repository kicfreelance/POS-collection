// Pure unit-conversion math — safe to import from client or server code.

export function convertToBaseQuantity(
  quantity: number,
  isSubUnit: boolean,
  factor: number,
): number {
  return isSubUnit ? quantity / factor : quantity;
}

export function proratedPrice(
  basePrice: number,
  quantity: number,
  isSubUnit: boolean,
  factor: number,
): number {
  return basePrice * convertToBaseQuantity(quantity, isSubUnit, factor);
}
