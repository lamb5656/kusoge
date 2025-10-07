export function serializeDeck(deck) { return JSON.stringify(deck); }
export function deserializeDeck(s) { try { return JSON.parse(s); } catch { return []; } }
