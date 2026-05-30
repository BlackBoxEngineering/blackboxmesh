export interface TerminalLogLine {
  ts: number;
  dir: 'in' | 'out';
  line: string;
}

const MAX_LOG = 300;
const HELP_LINES = [
  'BN GPS <lat> <lon> <acc>',
  'BN TX <to> <type> <hex>',
  'BN BCAST <text>',
  'BN BEACON',
  'BN STATUS?',
  'BN MESH ON|OFF',
  'BN RELAY ON|OFF',
];

class TerminalLogStore {
  private lines: TerminalLogLine[] = [
    { ts: Date.now(), dir: 'in', line: 'BlackBoxMesh Terminal' },
  ];
  private cbs: Array<(lines: TerminalLogLine[]) => void> = [];

  getAll(): TerminalLogLine[] {
    return this.lines;
  }

  onChange(cb: (lines: TerminalLogLine[]) => void): () => void {
    this.cbs.push(cb);
    cb(this.lines);
    return () => {
      this.cbs = this.cbs.filter((x) => x !== cb);
    };
  }

  addIn(line: string, ts = Date.now()): void {
    this.lines = [...this.lines.slice(-MAX_LOG + 1), { ts, dir: 'in', line }];
    this.emit();
  }

  addOut(line: string, ts = Date.now()): void {
    this.lines = [...this.lines.slice(-MAX_LOG + 1), { ts, dir: 'out', line }];
    this.emit();
  }

  addHelp(ts = Date.now()): void {
    const next = [...this.lines, { ts, dir: 'out' as const, line: 'help' }];
    for (const h of HELP_LINES) next.push({ ts, dir: 'in' as const, line: h });
    this.lines = next.slice(-MAX_LOG);
    this.emit();
  }

  private emit(): void {
    for (const cb of this.cbs) cb(this.lines);
  }
}

export const terminalLogStore = new TerminalLogStore();

