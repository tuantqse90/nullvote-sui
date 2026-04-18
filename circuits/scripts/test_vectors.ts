// Cross-language Poseidon test vector.
// MUST match output of Python (circomlib-py) and Circom (circomlib) for same input.
// If any language produces a different hash, STOP and debug before continuing Day 2+.
// Canonical source: circomlib BN254 Poseidon, t=3 (2-input variant).

const CANONICAL_HEX =
  '0x115cc0f5e7d690413df64c6b9662e9cf2a3617f2743245519e19607a4417189a';

function toHex32(x: bigint): string {
  return '0x' + x.toString(16).padStart(64, '0');
}

(async () => {
  const { poseidon2 } = await import('poseidon-lite');

  const input: [bigint, bigint] = [1n, 2n];
  const out = poseidon2(input);
  const outHex = toHex32(BigInt(out));

  console.log('  lib:      poseidon-lite');
  console.log('  input:    [1, 2]');
  console.log('  output:   ' + outHex);
  console.log('  expected: ' + CANONICAL_HEX);

  if (outHex.toLowerCase() !== CANONICAL_HEX.toLowerCase()) {
    console.error('\n✗ MISMATCH — JS Poseidon does not match canonical value');
    console.error('  This breaks cross-language consistency. Do NOT proceed to Day 2.');
    process.exit(1);
  }

  console.log('\n✓ JS Poseidon([1, 2]) matches canonical value');
})().catch((err) => {
  console.error('✗ Test failed:', err);
  process.exit(1);
});
