#!/usr/bin/env python3
"""Offline pix2tex worker. Requires explicitly provisioned local model weights."""
import json
import os
import sys
from pathlib import Path


def main():
    if len(sys.argv) != 4:
        raise RuntimeError("expected image, config, checkpoint")
    image, config, checkpoint = (Path(arg).resolve() for arg in sys.argv[1:])
    if not image.is_file() or not config.is_file() or not checkpoint.is_file():
        raise RuntimeError("model assets or input image missing")
    if checkpoint.stat().st_size < 1_000_000:
        raise RuntimeError("checkpoint too small")
    os.environ["HF_HUB_OFFLINE"] = "1"
    os.environ["TRANSFORMERS_OFFLINE"] = "1"
    os.environ["CUDA_VISIBLE_DEVICES"] = ""
    from munch import Munch
    from PIL import Image
    from pix2tex.cli import LatexOCR

    options = Munch({
        "config": str(config), "checkpoint": str(checkpoint),
        "no_cuda": True, "no_resize": False,
    })
    model = LatexOCR(options)
    with Image.open(image) as picture:
        latex = model(picture.convert("RGB"))
    if not isinstance(latex, str):
        raise RuntimeError("invalid model output")
    print("MATH_OCR_RESULT:" + json.dumps(latex, ensure_ascii=False))


if __name__ == "__main__":
    main()
