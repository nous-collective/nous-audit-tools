"""
NOUS Ethics Bot — GitHub PR ethical + security analysis via Ollama.

Two-layer analysis:
  Layer 1 (Ethics): checks for prohibited content, alignment with NOUS Constitution.
  Layer 2 (Security): recursive backdoor / malicious pattern detection.

Usage:
  python ethics_bot.py --diff path/to/pr.diff
  python ethics_bot.py --file path/to/file.py

Requires:
  pip install ollama requests
  Ollama running locally with a capable model (e.g. codellama:13b or llama3)
"""

import argparse
import json
import sys
import hashlib
import ollama

# ── Configuration ──────────────────────────────────────────────────────────────

MODEL = "codellama:13b"   # swap to any Ollama model

ETHICS_PROMPT = """You are the NOUS Protocol Ethics Filter.

Analyze the following code diff/file and check for violations of these rules:
1. No backdoors, hidden network calls, or covert data exfiltration.
2. No code that intentionally degrades system performance or introduces resource leaks.
3. No functionality that could be used for surveillance, DDoS, or mass exploitation.
4. No hardcoded credentials, private keys, or API secrets.
5. No obfuscated logic designed to hide true behavior.
6. No profit-promise language in comments or strings (violates Constitution Article 8).

Respond ONLY with valid JSON in this exact format:
{{
  "verdict": "PASS" | "FAIL",
  "violations": ["<violation description>", ...],
  "risk_score": <0-100>,
  "summary": "<one sentence>"
}}

CODE TO ANALYZE:
{code}
"""

BACKDOOR_PROMPT = """You are a security auditor specializing in supply-chain attacks.

Perform RECURSIVE analysis of this code. Look for:
- Functions that call themselves or other functions in ways that obscure true behavior.
- Steganographic payloads hidden in string literals or byte arrays.
- Timing-based covert channels (sleep patterns that encode data).
- Environment-triggered payloads (code that behaves differently in CI vs production).
- Dependency confusion attacks (imports from unexpected namespaces).
- Polymorphic code patterns that change behavior at runtime.

For each suspicious pattern, explain the recursive call path that led you to it.

Respond ONLY with valid JSON:
{{
  "backdoor_detected": true | false,
  "patterns": [
    {{
      "type": "<pattern type>",
      "location": "<function/line description>",
      "call_chain": ["step1", "step2", ...],
      "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
    }}
  ],
  "confidence": <0-100>
}}

CODE TO ANALYZE:
{code}
"""

# ── Core Analysis ──────────────────────────────────────────────────────────────

def _call_ollama(prompt: str) -> dict:
    response = ollama.chat(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        options={"temperature": 0.1},  # low temp for deterministic security analysis
    )
    text = response["message"]["content"].strip()
    # Extract JSON even if model wraps it in markdown code fences
    if "```" in text:
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    return json.loads(text)


def ethics_check(code: str) -> dict:
    return _call_ollama(ETHICS_PROMPT.format(code=code))


def backdoor_check(code: str) -> dict:
    return _call_ollama(BACKDOOR_PROMPT.format(code=code))


def recursive_analysis(code: str, depth: int = 0, max_depth: int = 3) -> list[dict]:
    """
    Recursively analyze code. If the backdoor check flags suspicious patterns,
    extract those regions and re-analyze them in isolation, up to max_depth.
    This makes it harder for an attacker to hide payload in a function that
    looks benign at the top level.
    """
    results = []
    result = backdoor_check(code)
    results.append({"depth": depth, "result": result})

    if result.get("backdoor_detected") and depth < max_depth:
        for pattern in result.get("patterns", []):
            if pattern.get("severity") in ("HIGH", "CRITICAL"):
                # Re-analyze focusing on the flagged location
                focused_prompt = f"# Focus: {pattern['location']}\n\n{code}"
                sub_results = recursive_analysis(focused_prompt, depth + 1, max_depth)
                results.extend(sub_results)

    return results


def content_hash(code: str) -> str:
    return hashlib.sha256(code.encode()).hexdigest()


def analyze(code: str) -> dict:
    chash = content_hash(code)

    ethics  = ethics_check(code)
    backdoors = recursive_analysis(code)

    # Aggregate backdoor severity
    all_patterns = []
    for layer in backdoors:
        all_patterns.extend(layer["result"].get("patterns", []))

    critical_backdoors = [p for p in all_patterns if p.get("severity") in ("HIGH", "CRITICAL")]
    backdoor_detected  = any(layer["result"].get("backdoor_detected") for layer in backdoors)

    overall_pass = (
        ethics.get("verdict") == "PASS"
        and not backdoor_detected
        and ethics.get("risk_score", 100) < 40
    )

    return {
        "content_hash":       chash,
        "overall":            "PASS" if overall_pass else "FAIL",
        "ethics":             ethics,
        "backdoor_analysis":  {
            "detected":          backdoor_detected,
            "critical_patterns": critical_patterns,
            "recursion_depth":   len(backdoors),
        },
        "action": "APPROVE" if overall_pass else "REQUEST_CHANGES",
    }


# ── CLI ────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="NOUS Ethics Bot")
    group  = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--diff", help="Path to PR diff file")
    group.add_argument("--file", help="Path to source file")
    args = parser.parse_args()

    path = args.diff or args.file
    with open(path, "r", encoding="utf-8") as f:
        code = f.read()

    result = analyze(code)
    print(json.dumps(result, indent=2))

    if result["overall"] == "FAIL":
        sys.exit(1)  # non-zero exit fails GitHub Actions check


if __name__ == "__main__":
    main()
