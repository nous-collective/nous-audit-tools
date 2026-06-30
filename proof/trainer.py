"""
NOUS Proof-of-Training — Loss-Hash Chain Generator (Compute Provider side).

Each training step produces a hash that encodes:
  - The loss value at that step
  - The hash of the PREVIOUS step (causal linkage)
  - A provider-specific nonce (prevents pre-computation of chains)

This makes it cryptographically impossible to submit a pre-trained model
as original work: any chain must start from the genesis hash signed by
the Protocol before training begins.

Usage:
  python trainer.py --task-id <bytes32> --epochs 10 --genesis <hex>
"""

import argparse
import hashlib
import json
import time
import random  # replace with real loss values from your training loop


def compute_step_hash(
    step: int,
    loss: float,
    prev_hash: str,
    provider_nonce: str,
    task_id: str,
) -> str:
    """
    H(step || loss_quantized || prev_hash || provider_nonce || task_id)

    loss_quantized: rounded to 6 decimal places to allow minor float variance
    while still binding to a specific loss trajectory.
    """
    loss_q  = round(loss, 6)
    payload = f"{step}:{loss_q}:{prev_hash}:{provider_nonce}:{task_id}"
    return hashlib.sha256(payload.encode()).hexdigest()


def generate_chain(
    task_id: str,
    genesis_hash: str,
    provider_nonce: str,
    loss_values: list[float],
) -> list[dict]:
    """
    Produce the full Loss-Hash Chain for a training run.

    genesis_hash: provided by the Protocol before training starts —
                  this is what anchors the chain to a specific task
                  and prevents replay of old chains.
    """
    chain    = []
    cur_hash = genesis_hash

    for step, loss in enumerate(loss_values):
        step_hash = compute_step_hash(step, loss, cur_hash, provider_nonce, task_id)
        chain.append({
            "step":      step,
            "loss":      loss,
            "prev_hash": cur_hash,
            "hash":      step_hash,
            "timestamp": int(time.time()),
        })
        cur_hash = step_hash

    return chain


def save_proof(chain: list[dict], output_path: str, task_id: str, provider_nonce: str):
    proof = {
        "task_id":        task_id,
        "provider_nonce": provider_nonce,
        "step_count":     len(chain),
        "final_hash":     chain[-1]["hash"] if chain else None,
        "genesis_hash":   chain[0]["prev_hash"] if chain else None,
        "chain":          chain,
    }
    with open(output_path, "w") as f:
        json.dump(proof, f, indent=2)
    print(f"Proof written to {output_path}")
    print(f"Final hash: {proof['final_hash']}")


# ── CLI ────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="NOUS Proof-of-Training generator")
    parser.add_argument("--task-id",       required=True, help="Task ID (bytes32 hex)")
    parser.add_argument("--genesis",       required=True, help="Genesis hash from Protocol")
    parser.add_argument("--nonce",         required=True, help="Provider nonce (random secret)")
    parser.add_argument("--epochs",        type=int, default=10)
    parser.add_argument("--output",        default="proof.json")
    args = parser.parse_args()

    # In production, replace this with actual loss values from your training loop.
    # E.g.: loss_values = [trainer.train_one_epoch() for _ in range(args.epochs)]
    loss_values = [2.5 - (i * 0.18) + random.uniform(-0.02, 0.02) for i in range(args.epochs)]

    chain = generate_chain(
        task_id        = args.task_id,
        genesis_hash   = args.genesis,
        provider_nonce = args.nonce,
        loss_values    = loss_values,
    )

    save_proof(chain, args.output, args.task_id, args.nonce)


if __name__ == "__main__":
    main()
