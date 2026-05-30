import { useEffect, useRef, useState } from 'react';
import { radioTransportManager } from '../services/transport/radioTransportManager';
import type { TransportStatus } from '../services/transport/types';
import { terminalLogStore, type TerminalLogLine } from '../services/terminalLogStore';

export function BottomTerminal() {
  const FILTER_KEY = 'terminal.filters.v1';
  const [open, setOpen] = useState(() => localStorage.getItem('terminal.open') === 'true');
  const [status, setStatus] = useState<TransportStatus>(() => radioTransportManager.getStatus());
  const [nodeId, setNodeId] = useState<string | null>(() => radioTransportManager.getNodeId());
  const [input, setInput] = useState('');
  const [lines, setLines] = useState<TerminalLogLine[]>(terminalLogStore.getAll());
  const [showIn, setShowIn] = useState(() => sessionStorage.getItem(`${FILTER_KEY}.showIn`) !== 'false');
  const [showOut, setShowOut] = useState(() => sessionStorage.getItem(`${FILTER_KEY}.showOut`) !== 'false');
  const [onlyErr, setOnlyErr] = useState(() => sessionStorage.getItem(`${FILTER_KEY}.onlyErr`) === 'true');
  const [onlyHelp, setOnlyHelp] = useState(() => sessionStorage.getItem(`${FILTER_KEY}.onlyHelp`) === 'true');
  const [query, setQuery] = useState(() => sessionStorage.getItem(`${FILTER_KEY}.query`) || '');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('terminal.open', String(open));
  }, [open]);

  useEffect(() => { sessionStorage.setItem(`${FILTER_KEY}.showIn`, String(showIn)); }, [showIn]);
  useEffect(() => { sessionStorage.setItem(`${FILTER_KEY}.showOut`, String(showOut)); }, [showOut]);
  useEffect(() => { sessionStorage.setItem(`${FILTER_KEY}.onlyErr`, String(onlyErr)); }, [onlyErr]);
  useEffect(() => { sessionStorage.setItem(`${FILTER_KEY}.onlyHelp`, String(onlyHelp)); }, [onlyHelp]);
  useEffect(() => { sessionStorage.setItem(`${FILTER_KEY}.query`, query); }, [query]);

  useEffect(() => {
    const offStatus = radioTransportManager.onStatus((s) => {
      setStatus(s);
      setNodeId(radioTransportManager.getNodeId());
    });
    const offLines = terminalLogStore.onChange(setLines);
    return () => {
      offStatus();
      offLines();
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines, open]);

  const submit = async () => {
    const line = input.trim();
    if (!line) return;

    if (line === 'help' || line === '?') {
      terminalLogStore.addHelp();
      setInput('');
      return;
    }

    terminalLogStore.addOut(line);
    setInput('');
    try {
      await radioTransportManager.sendLine(line);
    } catch (error) {
      terminalLogStore.addIn(`ERR ${(error as Error)?.message || 'send failed'}`);
    }
  };

  const visibleLines = lines.filter((l) => {
    if (!showIn && l.dir === 'in') return false;
    if (!showOut && l.dir === 'out') return false;
    if (onlyErr && !/^ERR\b/i.test(l.line)) return false;
    if (onlyHelp && !/^BN\s/i.test(l.line) && l.line !== 'help') return false;
    if (query && !l.line.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="bg-black border-t border-gray-700 flex flex-col">
      <div className="px-3 py-2 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-3 text-sm">
          <button
            onClick={() => setOpen((v) => !v)}
            className="px-2 py-1 rounded bg-gray-700 hover:bg-gray-600"
          >
            Terminal {open ? 'v' : '>'}
          </button>
          <span className="text-gray-300">
            {status === 'connected' ? `Connected ${nodeId ?? ''}` : status}
          </span>
        </div>
      </div>
      {open && (
        <>
          <div className="px-2 py-1 border-b border-gray-700 flex flex-wrap items-center gap-1 text-[11px]">
            <button onClick={() => setShowIn((v) => !v)} className={`px-2 py-0.5 rounded ${showIn ? 'bg-green-800' : 'bg-gray-700'}`}>in</button>
            <button onClick={() => setShowOut((v) => !v)} className={`px-2 py-0.5 rounded ${showOut ? 'bg-blue-800' : 'bg-gray-700'}`}>out</button>
            <button onClick={() => setOnlyErr((v) => !v)} className={`px-2 py-0.5 rounded ${onlyErr ? 'bg-red-800' : 'bg-gray-700'}`}>errors</button>
            <button onClick={() => setOnlyHelp((v) => !v)} className={`px-2 py-0.5 rounded ${onlyHelp ? 'bg-yellow-800' : 'bg-gray-700'}`}>help</button>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="search"
              className="ml-auto bg-gray-900 border border-gray-700 rounded px-2 py-0.5 text-[11px]"
            />
          </div>
          <div ref={scrollRef} className="h-44 p-3 font-mono text-xs overflow-y-auto">
            {visibleLines.map((l, i) => (
              <div key={`${l.ts}-${i}`} className={l.dir === 'in' ? 'text-green-300' : 'text-blue-300'}>
                <span className="text-gray-500">{new Date(l.ts).toLocaleTimeString()} </span>
                <span className="text-gray-500">{l.dir === 'in' ? '<' : '>'}</span> {l.line}
              </div>
            ))}
          </div>
          <div className="p-2 border-t border-gray-700">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void submit()}
              placeholder="Type command (help for list)"
              className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500 text-sm font-mono"
            />
          </div>
        </>
      )}
    </div>
  );
}
