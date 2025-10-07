export function connectMatchmaker(baseUrl) {
  return new Promise((resolve, reject) => {
    const url = baseUrl.replace(/^http/, "ws") + "/match";
    const ws = new WebSocket(url);
    const timer = setTimeout(() => { try { ws.close(); } catch (e) {} reject(new Error("Match timeout")); }, 60_000);
    ws.onmessage = (ev) => { try { const msg = JSON.parse(ev.data); if (msg.type === "match-found") { clearTimeout(timer); try { ws.close(); } catch (e) {} resolve(msg); } } catch (e) {} };
    ws.onerror = (e) => { clearTimeout(timer); reject(e); };
  });
}
export function connectRoom(baseUrl, roomId, handlers) {
  return new Promise((resolve, reject) => {
    const url = baseUrl.replace(/^http/, "ws") + "/room/" + roomId;
    const ws = new WebSocket(url);
    const api = { send(obj){ ws.send(JSON.stringify(obj)); }, close(){ ws.close(); }, get ready(){ return ws.readyState === WebSocket.OPEN; } };
    ws.onopen = () => { resolve(api); handlers?.onOpen?.(api); };
    ws.onmessage = (ev) => { try { handlers?.onMessage?.(JSON.parse(ev.data)); } catch (e) { console.error(e); } };
    ws.onerror = (e) => { handlers?.onError?.(e); reject(e); };
    ws.onclose = () => { handlers?.onClose?.(); };
  });
}
