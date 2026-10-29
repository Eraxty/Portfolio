"""Render every caption in src/lines.json to public/voice/<id>.mp3 with Piper TTS.

Generic British Piper voices, then a little ffmpeg character: Wheatley quicker and higher,
GLaDOS slower with a synthetic flange. Re-run after editing lines.json.

  python tools/render-voices.py --piper <path/to/piper> --voices <dir with .onnx voices>
"""
import argparse, json, pathlib, subprocess, tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
CAST = {
    'Wheatley': {'voice': 'en_GB-alan-medium.onnx', 'length': '0.86',
                 'fx': 'asetrate=22050*1.09,aresample=44100,atempo=0.96,highpass=f=90,acompressor=threshold=-18dB:ratio=3'},
    'GLaDOS': {'voice': 'en_GB-jenny_dioco-medium.onnx', 'length': '1.08',
               'fx': 'asetrate=22050*1.04,aresample=44100,atempo=0.97,flanger=delay=2:depth=2:speed=0.3,highpass=f=140,aecho=0.8:0.5:12:0.25'},
}

ap = argparse.ArgumentParser()
ap.add_argument('--piper', required=True)
ap.add_argument('--voices', required=True)
args = ap.parse_args()

out_dir = ROOT / 'public' / 'voice'
out_dir.mkdir(parents=True, exist_ok=True)
for line in json.loads((ROOT / 'src' / 'lines.json').read_text()):
    cast = CAST[line['who']]
    with tempfile.TemporaryDirectory() as tmp:
        wav = pathlib.Path(tmp) / 'raw.wav'
        subprocess.run([args.piper, '-m', str(pathlib.Path(args.voices) / cast['voice']), '-f', str(wav),
                        '--length-scale', cast['length']], input=line['text'].encode(), check=True, capture_output=True)
        dst = out_dir / f"{line['id']}.mp3"
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(wav), '-af', cast['fx'],
                        '-ac', '1', '-b:a', '56k', str(dst)], check=True)
        print(f"{dst.name:22} {dst.stat().st_size // 1024:>3} KB  {line['who']}: {line['text']}")
