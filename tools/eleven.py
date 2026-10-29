"""ElevenLabs pipeline for the site's voices and sound effects.

The API key is read from ~/.config/eraxty/elevenlabs.env (ELEVENLABS_API_KEY=...), never from the repo.

  python tools/eleven.py design <role> [--out DIR]   # 3 preview voices for a role, saved as mp3 to listen to
  python tools/eleven.py save <role> <generated_voice_id>   # keep a preview as a real voice, id stored in tools/voices.json
  python tools/eleven.py render [--only id,id]        # every line in src/lines.json -> public/voice/<id>.mp3
  python tools/eleven.py sfx [--only id,id]           # every effect in tools/sfx.json -> public/sfx/<id>.mp3

Voices are designed from a description of the character, not cloned from anyone.
"""
import argparse, base64, json, os, pathlib, subprocess, sys, tempfile, urllib.error, urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
API = 'https://api.elevenlabs.io'
VOICES = ROOT / 'tools' / 'voices.json'

ROLES = {
    'Wheatley': {
        'description': ('A nervous, over-eager robot personality core speaking with an English accent. Young-sounding man, '
                        'talks very fast, rambles, trips over his own words, endearingly anxious and chatty, '
                        'light and slightly reedy voice, comedic timing, clean studio recording.'),
        'preview': ('Oh! Hello! Hello, hi. Right, okay, so this is the website. Lovely, isn\'t it? Very clean. '
                    'Don\'t touch anything. Well, you can touch things, obviously, that is sort of the point, '
                    'just, maybe not the eye. The eye is sensitive. Anyway! Scroll down. Lots to see.'),
        'settings': {'stability': 0.0, 'similarity_boost': 0.8, 'style': 0.6, 'use_speaker_boost': True},
        'fx': 'highpass=f=80,acompressor=threshold=-20dB:ratio=3:makeup=2',
    },
    'GLaDOS': {
        'description': ('A calm, cold artificial intelligence that runs a science facility. Female voice, mid-low pitch, '
                        'precise clipped delivery, perfectly even and controlled, dry sarcasm, slightly synthetic, '
                        'clean studio recording.'),
        'preview': ('Oh. It\'s you. Welcome to the portfolio. Please continue scrolling at a steady pace. '
                    'Your progress is being monitored. Your progress is always being monitored. '
                    'There will be no cake at the end of this page.'),
        'settings': {'stability': 0.5, 'similarity_boost': 0.8, 'style': 0.2, 'use_speaker_boost': True},
        # a little machine in the throat: flange, a short metallic slap, keep the lows tidy
        'fx': 'highpass=f=120,flanger=delay=1.5:depth=1.5:speed=0.25:width=60,aecho=0.8:0.4:9:0.22,acompressor=threshold=-20dB:ratio=3',
    },
}


def key():
    env = pathlib.Path.home() / '.config' / 'eraxty' / 'elevenlabs.env'
    if os.environ.get('ELEVENLABS_API_KEY'):
        return os.environ['ELEVENLABS_API_KEY']
    if env.exists():
        for line in env.read_text().splitlines():
            if line.strip().startswith('ELEVENLABS_API_KEY='):
                return line.split('=', 1)[1].strip().strip('"\'')
    sys.exit(f'No API key. Put ELEVENLABS_API_KEY=... in {env}')


def call(path, body=None, raw=False):
    req = urllib.request.Request(API + path, method='POST' if body is not None else 'GET',
                                 data=json.dumps(body).encode() if body is not None else None,
                                 headers={'xi-api-key': key(), 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            data = r.read()
            return data if raw else json.loads(data)
    except urllib.error.HTTPError as e:
        raise RuntimeError(f'{e.code} {path}: {e.read().decode(errors="replace")[:400]}') from None


def finish(raw_mp3, dst, fx):
    """Trim silence at the ends, apply the role's character, write a small mono mp3."""
    dst.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(suffix='.mp3') as tmp:
        tmp.write(raw_mp3)
        tmp.flush()
        chain = 'silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse'
        if fx:
            chain += ',' + fx
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', tmp.name, '-af', chain, '-ac', '1', '-b:a', '64k', str(dst)], check=True)


def design(role, out):
    r = ROLES[role]
    try:
        res = call('/v1/text-to-voice/design', {'voice_description': r['description'], 'text': r['preview'], 'model_id': 'eleven_ttv_v3'})
    except RuntimeError as e:
        print('design endpoint failed, trying create-previews:', e)
        res = call('/v1/text-to-voice/create-previews', {'voice_description': r['description'], 'text': r['preview']})
    out.mkdir(parents=True, exist_ok=True)
    for i, p in enumerate(res.get('previews', []), 1):
        f = out / f'{role.lower()}-{i}.mp3'
        f.write_bytes(base64.b64decode(p['audio_base_64']))
        print(f'{f}  generated_voice_id={p["generated_voice_id"]}')


def save(role, generated_id):
    body = {'voice_name': f'Eraxty {role}', 'voice_description': ROLES[role]['description'], 'generated_voice_id': generated_id}
    try:
        res = call('/v1/text-to-voice', body)
    except RuntimeError as e:
        print('text-to-voice failed, trying create-voice-from-preview:', e)
        res = call('/v1/text-to-voice/create-voice-from-preview', body)
    voices = json.loads(VOICES.read_text()) if VOICES.exists() else {}
    voices[role] = res['voice_id']
    VOICES.write_text(json.dumps(voices, indent=2) + '\n')
    print(f'{role} -> {res["voice_id"]} (saved in {VOICES.relative_to(ROOT)})')


def render(only):
    voices = json.loads(VOICES.read_text())
    for line in json.loads((ROOT / 'src' / 'lines.json').read_text()):
        if only and line['id'] not in only:
            continue
        role = ROLES[line['who']]
        text = line.get('say', line['text'])   # 'say' may carry v3 audio tags like [nervous laugh]
        audio = call(f'/v1/text-to-speech/{voices[line["who"]]}?output_format=mp3_44100_128',
                     {'text': text, 'model_id': 'eleven_v3', 'voice_settings': role['settings']}, raw=True)
        dst = ROOT / 'public' / 'voice' / f'{line["id"]}.mp3'
        finish(audio, dst, role['fx'])
        print(f'{dst.name:22} {dst.stat().st_size // 1024:>3} KB  {line["who"]}: {line["text"]}')


def sfx(only):
    for fx in json.loads((ROOT / 'tools' / 'sfx.json').read_text()):
        if only and fx['id'] not in only:
            continue
        body = {'text': fx['prompt'], 'prompt_influence': fx.get('influence', 0.5)}
        if fx.get('seconds'):
            body['duration_seconds'] = fx['seconds']
        if fx.get('loop'):
            body['loop'] = True
        audio = call('/v1/sound-generation', body, raw=True)
        dst = ROOT / 'public' / 'sfx' / f'{fx["id"]}.mp3'
        dst.parent.mkdir(parents=True, exist_ok=True)
        if fx.get('loop'):
            dst.write_bytes(audio)   # keep loops untrimmed so the seam stays where the model put it
        else:
            finish(audio, dst, None)
        print(f'{dst.name:24} {dst.stat().st_size // 1024:>3} KB  {fx["prompt"][:70]}')
    # tell the site which effects exist so it only fetches real files
    have = sorted(f.stem for f in (ROOT / 'public' / 'sfx').glob('*.mp3'))
    (ROOT / 'public' / 'sfx' / 'index.json').write_text(json.dumps(have) + '\n')


ap = argparse.ArgumentParser()
sub = ap.add_subparsers(dest='cmd', required=True)
d = sub.add_parser('design'); d.add_argument('role', choices=ROLES); d.add_argument('--out', type=pathlib.Path, default=pathlib.Path('voice-previews'))
s = sub.add_parser('save'); s.add_argument('role', choices=ROLES); s.add_argument('generated_id')
r = sub.add_parser('render'); r.add_argument('--only', default='')
x = sub.add_parser('sfx'); x.add_argument('--only', default='')
a = ap.parse_args()
if a.cmd == 'design':
    design(a.role, a.out)
elif a.cmd == 'save':
    save(a.role, a.generated_id)
elif a.cmd == 'render':
    render(set(filter(None, a.only.split(','))))
else:
    sfx(set(filter(None, a.only.split(','))))
