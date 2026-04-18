// Convert snarkjs groth16 artefacts (verification_key.json, proof.json, public.json)
// into arkworks canonical-compressed byte blobs suitable for sui::groth16.
//
// Outputs (written next to the inputs in `circuits/build/`):
//   vk.bin           — arkworks compressed VerifyingKey<Bn254>
//   proof_points.bin — A || B || C (compressed Bn254 G1/G2/G1)
//   public_inputs.bin — N × 32-byte little-endian scalar field elements
//
// The Move module expects these byte blobs verbatim. Regenerate after any circuit
// change or new Phase-2 contribution.

use ark_bn254::{Bn254, Fq, Fq2, Fr, G1Affine, G2Affine};
use ark_ec::AffineRepr;
use ark_ff::{BigInt, PrimeField};
use ark_groth16::{Proof, VerifyingKey};
use ark_serialize::CanonicalSerialize;
use num_bigint::BigUint;
use serde_json::Value;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::str::FromStr;

fn parse_fq(s: &str) -> Fq {
    let n = BigUint::from_str(s).expect("fq: decimal string");
    Fq::from_le_bytes_mod_order(&n.to_bytes_le())
}

fn parse_fr(s: &str) -> Fr {
    let n = BigUint::from_str(s).expect("fr: decimal string");
    Fr::from_le_bytes_mod_order(&n.to_bytes_le())
}

fn parse_g1(arr: &Value) -> G1Affine {
    // arr[2] is projective z — expected "1" for affine
    if arr[2].as_str() == Some("0") {
        return G1Affine::zero();
    }
    let x = parse_fq(arr[0].as_str().expect("g1.x"));
    let y = parse_fq(arr[1].as_str().expect("g1.y"));
    let p = G1Affine::new(x, y);
    assert!(p.is_on_curve(), "G1 point not on curve");
    p
}

fn parse_g2(arr: &Value) -> G2Affine {
    // snarkjs stores Fp2 as [c0, c1] — same convention as arkworks.
    if arr[2][0].as_str() == Some("0") && arr[2][1].as_str() == Some("0") {
        return G2Affine::zero();
    }
    let x_c0 = parse_fq(arr[0][0].as_str().expect("g2.x.c0"));
    let x_c1 = parse_fq(arr[0][1].as_str().expect("g2.x.c1"));
    let y_c0 = parse_fq(arr[1][0].as_str().expect("g2.y.c0"));
    let y_c1 = parse_fq(arr[1][1].as_str().expect("g2.y.c1"));
    let x = Fq2::new(x_c0, x_c1);
    let y = Fq2::new(y_c0, y_c1);
    let p = G2Affine::new(x, y);
    assert!(p.is_on_curve(), "G2 point not on curve");
    p
}

fn write_bytes(path: &Path, bytes: &[u8]) -> std::io::Result<()> {
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir)?;
    }
    fs::write(path, bytes)?;
    println!("  wrote {:?} ({} bytes)", path, bytes.len());
    Ok(())
}

fn compress<T: CanonicalSerialize>(point: &T) -> Vec<u8> {
    let mut out = Vec::new();
    point.serialize_compressed(&mut out).expect("serialize");
    out
}

fn export_vk(vk_json: &Value, out_dir: &Path) -> std::io::Result<()> {
    let alpha_g1 = parse_g1(&vk_json["vk_alpha_1"]);
    let beta_g2 = parse_g2(&vk_json["vk_beta_2"]);
    let gamma_g2 = parse_g2(&vk_json["vk_gamma_2"]);
    let delta_g2 = parse_g2(&vk_json["vk_delta_2"]);

    let ic = vk_json["IC"].as_array().expect("IC array");
    let gamma_abc_g1: Vec<G1Affine> = ic.iter().map(parse_g1).collect();

    let vk = VerifyingKey::<Bn254> {
        alpha_g1,
        beta_g2,
        gamma_g2,
        delta_g2,
        gamma_abc_g1,
    };

    let vk_bytes = compress(&vk);
    write_bytes(&out_dir.join("vk.bin"), &vk_bytes)?;
    Ok(())
}

fn export_proof(proof_json: &Value, out_dir: &Path) -> std::io::Result<()> {
    let pi_a = parse_g1(&proof_json["pi_a"]);
    let pi_b = parse_g2(&proof_json["pi_b"]);
    let pi_c = parse_g1(&proof_json["pi_c"]);

    let proof = Proof::<Bn254> {
        a: pi_a,
        b: pi_b,
        c: pi_c,
    };

    let bytes = compress(&proof);
    write_bytes(&out_dir.join("proof_points.bin"), &bytes)?;
    Ok(())
}

fn export_public(public_json: &Value, out_dir: &Path) -> std::io::Result<()> {
    let arr = public_json.as_array().expect("public.json is array");
    let mut bytes = Vec::with_capacity(arr.len() * 32);
    for v in arr {
        let s = v.as_str().expect("public input is string");
        let fr = parse_fr(s);
        // Little-endian 32-byte serialization of the field element — matches
        // sui::groth16::public_proof_inputs_from_bytes's contract.
        let BigInt::<4>(limbs) = fr.into_bigint();
        for limb in limbs.iter() {
            bytes.extend_from_slice(&limb.to_le_bytes());
        }
    }
    write_bytes(&out_dir.join("public_inputs.bin"), &bytes)?;
    Ok(())
}

fn main() -> std::io::Result<()> {
    let args: Vec<String> = env::args().collect();
    let build_dir = if args.len() > 1 {
        PathBuf::from(&args[1])
    } else {
        PathBuf::from("../../build")
    };

    let vk_path = build_dir.join("verification_key.json");
    let proof_path = build_dir.join("proof.json");
    let public_path = build_dir.join("public.json");

    println!("█ Reading from {:?}", build_dir);

    let vk: Value = serde_json::from_reader(fs::File::open(&vk_path)?)
        .expect("parse verification_key.json");
    export_vk(&vk, &build_dir)?;

    if proof_path.exists() {
        let proof: Value = serde_json::from_reader(fs::File::open(&proof_path)?)
            .expect("parse proof.json");
        export_proof(&proof, &build_dir)?;
    } else {
        println!("  (proof.json missing — skipping proof export)");
    }

    if public_path.exists() {
        let public: Value = serde_json::from_reader(fs::File::open(&public_path)?)
            .expect("parse public.json");
        export_public(&public, &build_dir)?;
    } else {
        println!("  (public.json missing — skipping public-inputs export)");
    }

    println!("█ Done.");
    Ok(())
}
