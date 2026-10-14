"""Export the Tinker-trained decoder for offline use on the laptop.

    python export.py            # needs TINKER_API_KEY, run.json, `ollama pull qwen3:8b`

Steps: download Tinker checkpoint -> PEFT adapter -> GGUF LoRA + llama-server binaries (llama.cpp b11200).
`pnpm dev` (run.mjs) then serves Ollama's qwen3:8b file + the LoRA with llama-server on :8791.
Ollama 0.17's engine rejects LoRA adapters ("loras are not yet implemented"), hence llama-server.
No full base-model weights are downloaded: the adapter build only needs parameter names/shapes, read from
Hugging Face safetensors headers over HTTP range requests.
"""
import json
import shutil
import subprocess
import sys
import tarfile
import urllib.request
from pathlib import Path

from huggingface_hub import hf_hub_download
from tinker_cookbook import weights
from tinker_cookbook.hyperparam_utils import _list_param_shapes_from_safetensors_remote
from tinker_cookbook.weights import _adapter

HERE = Path(__file__).parent
OUT = HERE / "out"
LLAMA_CPP_TAG = "b11200"  # 2026-09-26
BIN_ZIP = f"https://github.com/ggml-org/llama.cpp/releases/download/{LLAMA_CPP_TAG}/llama-{LLAMA_CPP_TAG}-bin-win-cpu-x64.zip"  # ponytail: Windows x64 only; other OSes: grab the matching asset from that release into out/llama-bin


def main() -> None:
    run = json.loads((HERE / "run.json").read_text())
    base = run["base_model"]
    ckpt, peft, cfg_dir = OUT / "tinker_ckpt", OUT / "peft", OUT / "qwen3-8b-config"
    if not (ckpt / "adapter_model.safetensors").exists():
        weights.download(tinker_path=run["model_path"], output_dir=str(ckpt))

    cfg_dir.mkdir(parents=True, exist_ok=True)
    for f in ["config.json", "generation_config.json", "tokenizer.json", "tokenizer_config.json", "vocab.json", "merges.txt"]:
        shutil.copy(hf_hub_download(base, f), cfg_dir / f)

    if not peft.exists():
        shapes = _list_param_shapes_from_safetensors_remote(base)
        # ponytail: patches private cookbook helpers so it reads shapes remotely instead of needing 16 GB of shards
        _adapter.get_model_state_shapes = lambda d: shapes
        _adapter.get_model_state_keys = lambda d: set(shapes)
        _adapter.build_lora_adapter(base_model=str(cfg_dir), adapter_path=str(ckpt), output_path=str(peft))
        cfg = json.loads((peft / "adapter_config.json").read_text())
        cfg["base_model_name_or_path"] = base
        (peft / "adapter_config.json").write_text(json.dumps(cfg, indent=2))

    llama = OUT / "llama.cpp"
    if not (llama / "convert_lora_to_gguf.py").exists():
        llama.mkdir(parents=True, exist_ok=True)
        url = f"https://codeload.github.com/ggml-org/llama.cpp/tar.gz/refs/tags/{LLAMA_CPP_TAG}"
        with urllib.request.urlopen(url) as r, tarfile.open(fileobj=r, mode="r|gz") as tf:
            for m in tf:
                parts = Path(m.name).parts[1:]
                if parts and not m.issym() and not m.islnk():
                    m.name = str(Path(*parts))
                    tf.extract(m, llama, filter="data")
        subprocess.run([sys.executable, "-m", "pip", "install", "-q", str(llama / "gguf-py")], check=True)

    gguf = OUT / "pfdesk-lora.gguf"
    subprocess.run([sys.executable, str(llama / "convert_lora_to_gguf.py"), str(peft), "--base", str(cfg_dir),
                    "--outtype", "f16", "--outfile", str(gguf)], check=True)
    bin_dir = OUT / "llama-bin"
    if not (bin_dir / "llama-server.exe").exists() and sys.platform == "win32":
        import io, zipfile
        with urllib.request.urlopen(BIN_ZIP) as r:
            zipfile.ZipFile(io.BytesIO(r.read())).extractall(bin_dir)
    print("done: set DECODER_MODEL=pfdesk-decoder and DECODER_BASE_URL=http://127.0.0.1:8791/v1 in .env, then `pnpm dev`")

if __name__ == "__main__":
    main()
