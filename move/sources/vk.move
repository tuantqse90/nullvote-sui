/// Hard-coded verifying key for the NullVote `vote.circom` circuit.
///
/// Bytes are the arkworks canonical-compressed serialization of the
/// snarkjs-generated `verification_key.json` — produced by
/// `circuits/scripts/export_vk_rs/target/release/nullvote-export-vk`.
///
/// If the circuit is recompiled or the Phase-2 ceremony rerun, regenerate
/// `vk.bin` and update the constant below. There is NO runtime-configurable
/// VK — same circuit for every election.
module nullvote::vk {
    /// arkworks canonical compressed VerifyingKey<Bn254> for vote.circom (424 bytes).
    const VK_BYTES: vector<u8> = x"e2f26dbea299f5223b646cb1fb33eadb059d9407559d7441dfd902e3a79a4d2dabb73dc17fbc13021e2471e0c08bd67d8401f52b73d6d07483794cad4778180e0c06f33bbc4c79a9cadef253a68084d382f17788f885c9afd176f7cb2f036789edf692d95cbdde46ddda5ef7d422436779445c5e66006a42761e1f12efde0018c212f3aeb785e49712e7a9353349aaf1255dfb31b7bf60723a480d9293938e19e4b449cecfd95b587a005ae289d43dd080b3c86f8552e4d5f2eebdf1949de117d9795d57f00d00f8427309a1ddc7a6500ef9cda01ff65e5a18183457e7121e9b0600000000000000ae6d849660aa10be7f0de79ec3d58b81c22de456cba65fac553892f7dc45e08e61d8f2d275c25139e39c9dca37779a1262a286d35447a497d86d8659a68c9400266e48646d9bc77e2d66069e5970211513bf5cb520c4e2b8e027b81000794f222829b6e614a78a6297231e526170240146f11b94524077830ca694a1783d0e81248a3d22dfc5e7e6532d45b01c342b75942bdcbef82986c41ec86f14ec69ed9152b58e25dd50a1af78d3d51e9c162d2a9b6b17b91f9abea148561db63bb4bf00";

    public fun bytes(): vector<u8> {
        VK_BYTES
    }
}
