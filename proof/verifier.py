"""
NOUS Proof-of-Training — Hash Chain Verifier (Protocol side).

The verifier receives a proof.json from a Compute Provider and:
  1. Confirms every step hash recomputes correctly from inputs.
  2. Confirms every prev_hash links to the previous step's hash.
  3. Confirms the chain starts from the Protocol-issued genesis hash.
  4. Confirms loss values follow a monotonically decreasing trend
     (with allowed variance) — a flat or random loss curve signals fake training.

On success, the verifier returns the final_hash that Staking.completeTask()
will record on-chain as the proof anchor.
"""

import json
import argparse
import hashlib
import sys


def compute_step_hash(step, loss, prev_hash, provider_nonce, task_id) -> str:
    loss_q  = round(loss, 6)
    payload = f"{step}:{loss_q}:{prev_hash}:{provider_nonce}:{task_id}"
    return hashlib.sha256(payload.encode()).hexdigest()


def verify_chain(proof: dict, expected_genesis: str) -> tuple[bool, str]:
    """
    Returns (ok, reason).
    """
    chain          = proof["chain"]
    task_id        = proof["task_id"]
    provider_nonce = proof["provider_nonce"]

    if not chain:
        return False, "Empty chain"

    # 1. Genesis anchor check
    if chain[0]["prev_hash"] != expected_genesis:
        return False, (
            f"Genesis mismatch: expected {expected_genesis}, "
            f"got {chain[0]['prev_hash']}"
        )

    losses = []

    for i, step_data in enumerate(chain):
        # 2. Recompute hash
        expected_hash = compute_step_hash(
            step_data["step"],
            step_data["loss"],
            step_data["prev_hash"],
            provider_nonce,
            task_id,
        )
        if expected_hash != step_data["hash"]:
            return False, f"Hash mismatch at step {i}"

        # 3. Chain linkage
        if i > 0 and step_data["prev_hash"] != chain[i - 1]["hash"]:
            return False, f"Chain break between step {i-1} and {i}"

        losses.append(step_data["loss"])

    # 4. Loss trend check: final loss must be lower than initial loss
    #    Allow up to 15% of steps to be non-decreasing (real training has noise).
    non_decreasing = sum(1 for j in range(1, len(losses)) if losses[j] >= losses[j - 1])
    if non_decreasing > len(losses) * 0.15:
        return False, (
            f"Suspicious loss curve: {non_decreasing}/{len(losses)} "
            "non-decreasing steps exceeds 15% threshold"
        )

    if losses[-1] >= losses[0]:
        return False, "Final loss not lower than initial loss — training did not converge"

    return True, "OK"


def main():
    parser = argparse.ArgumentParser(description="NOUS Proof-of-Training verifier")
    parser.add_argument("--proof",   required=True, help="Path to proof.json")
    parser.add_argument("--genesis", required=True, help="Expected genesis hash from Protocol")
    args = parser.parse_args()

    with open(args.proof) as f:
        proof = json.load(f)

    ok, reason = verify_chain(proof, args.genesis)

    result = {
        "task_id":    proof["task_id"],
        "verified":   ok,
        "reason":     reason,
        "final_hash": proof.get("final_hash") if ok else None,
        "steps":      proof.get("step_count"),
    }

    print(json.dumps(result, indent=2))

    if not ok:
        print(f"\nVERIFICATION FAILED: {reason}", file=sys.stderr)
        sys.exit(1)

    print(f"\nVERIFICATION PASSED. Submit final_hash to Staking.completeTask():")
    print(f"  {result['final_hash']}")


if __name__ == "__main__":
    main()
