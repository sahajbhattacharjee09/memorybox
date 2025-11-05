from flask import Flask, request, jsonify
from flask_cors import CORS
import redis
import os
import uuid
import json
import time

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
redis_client = redis.from_url(REDIS_URL, decode_responses=True)

app = Flask(__name__)
CORS(app)

NOTE_KEY_PREFIX = "note:"

@app.route('/notes', methods=['POST'])
def create_note():
    data = request.get_json() or {}
    text = (data.get('text') or '').strip()
    tag = (data.get('tag') or '').strip()
    try:
        ttl = int(data.get('ttl') or 600)
    except Exception:
        ttl = 600
    if not text:
        return jsonify({'error': 'empty text'}), 400

    note_id = str(uuid.uuid4())
    key = NOTE_KEY_PREFIX + note_id
    payload = {
        "text": text,
        "tag": tag,
        "orig_ttl": ttl,
        "created": int(time.time())
    }
    redis_client.set(key, json.dumps(payload), ex=ttl)
    return jsonify({'id': note_id, 'ttl': ttl}), 201

@app.route('/notes', methods=['GET'])
def list_notes():
    cursor = 0
    results = []
    while True:
        cursor, keys = redis_client.scan(cursor=cursor, match=NOTE_KEY_PREFIX + '*', count=100)
        for k in keys:
            raw = redis_client.get(k)
            ttl = redis_client.ttl(k)
            if raw is None:
                continue
            try:
                payload = json.loads(raw)
                text = payload.get('text', raw)
                tag = payload.get('tag', '')
                orig_ttl = int(payload.get('orig_ttl') or 0)
            except Exception:
                # fallback for old plain-string values
                text = raw
                tag = ''
                orig_ttl = 0
            results.append({
                'id': k.replace(NOTE_KEY_PREFIX, ''),
                'text': text,
                'tag': tag,
                'ttl': ttl,
                'orig_ttl': orig_ttl
            })
        if cursor == 0:
            break
    # sort by ttl ascending
    results.sort(key=lambda r: (r['ttl'] if r['ttl'] is not None else 0))
    return jsonify(results)

@app.route('/notes/<note_id>', methods=['DELETE'])
def delete_note(note_id):
    key = NOTE_KEY_PREFIX + note_id
    deleted = redis_client.delete(key)
    return jsonify({'deleted': bool(deleted)}), (200 if deleted else 404)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
