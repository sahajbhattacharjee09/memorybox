from flask import Flask, request, jsonify
from flask_cors import CORS
import redis
import os
import uuid

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
redis_client = redis.from_url(REDIS_URL, decode_responses=True)

app = Flask(__name__)
CORS(app)

NOTE_KEY_PREFIX = "note:"

@app.route('/notes', methods=['POST'])
def create_note():
    data = request.get_json() or {}
    text = (data.get('text') or '').strip()
    ttl = int(data.get('ttl') or 600)
    if not text:
        return jsonify({'error': 'empty text'}), 400
    note_id = str(uuid.uuid4())
    key = NOTE_KEY_PREFIX + note_id
    redis_client.set(key, text, ex=ttl)
    return jsonify({'id': note_id, 'ttl': ttl}), 201

@app.route('/notes', methods=['GET'])
def list_notes():
    cursor = 0
    results = []
    while True:
        cursor, keys = redis_client.scan(cursor=cursor, match=NOTE_KEY_PREFIX + '*', count=100)
        for k in keys:
            val = redis_client.get(k)
            ttl = redis_client.ttl(k)
            if val is not None:
                results.append({'id': k.replace(NOTE_KEY_PREFIX, ''), 'text': val, 'ttl': ttl})
        if cursor == 0:
            break
    results.sort(key=lambda r: (r['ttl'] if r['ttl'] is not None else 0))
    return jsonify(results)

@app.route('/notes/<note_id>', methods=['DELETE'])
def delete_note(note_id):
    key = NOTE_KEY_PREFIX + note_id
    deleted = redis_client.delete(key)
    return jsonify({'deleted': bool(deleted)})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
