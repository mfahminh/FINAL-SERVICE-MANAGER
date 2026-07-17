import { useEffect, useState } from "react";
import api, { fmtDate } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  useEffect(() => { api.get("/audit-logs").then((r) => setLogs(r.data)); }, []);

  return (
    <div className="space-y-5" data-testid="audit-page">
      <div>
        <div className="text-[11px] uppercase tracking-[0.25em] text-primary font-semibold">Security</div>
        <h1 className="font-display font-black text-3xl tracking-tight">Audit Log</h1>
      </div>
      <Card className="border border-border">
        <Table>
          <TableHeader><TableRow><TableHead>Waktu</TableHead><TableHead>User</TableHead><TableHead>Aksi</TableHead><TableHead>Entitas</TableHead><TableHead className="hidden md:table-cell">Detail</TableHead></TableRow></TableHeader>
          <TableBody>
            {logs.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">Belum ada log</TableCell></TableRow>}
            {logs.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="text-xs text-muted-foreground">{fmtDate(l.created_at)}</TableCell>
                <TableCell><div className="font-semibold text-sm">{l.user_name}</div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">{l.user_role}</div></TableCell>
                <TableCell><Badge variant="outline" className="font-mono text-xs">{l.action}</Badge></TableCell>
                <TableCell className="font-mono text-xs">{l.entity}</TableCell>
                <TableCell className="hidden md:table-cell text-xs text-muted-foreground truncate max-w-md">{JSON.stringify(l.details)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
