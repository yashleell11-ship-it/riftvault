const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const BTC_ADDRESS = /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/;

export function isValidCryptoAddress(address: string) {
  const trimmed = address.trim();
  if (trimmed.length < 26 || trimmed.length > 100) return false;
  return EVM_ADDRESS.test(trimmed) || BTC_ADDRESS.test(trimmed);
}

export function normalizeCryptoAddress(address: string) {
  const trimmed = address.trim();
  if (EVM_ADDRESS.test(trimmed)) return trimmed.toLowerCase();
  return trimmed;
}

export function truncateAddress(address: string, head = 6, tail = 4) {
  if (address.length <= head + tail + 1) return address;
  return `${address.slice(0, head)}…${address.slice(-tail)}`;
}
