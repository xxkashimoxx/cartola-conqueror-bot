#!/usr/bin/env node
/**
 * CI guard: falha se qualquer resquício de plano/PRO/upgrade voltar ao frontend.
 * Roda com: `node scripts/check-no-plans.mjs`
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const SRC = join(ROOT, "src");

// Extensões inspecionadas
const EXTS = new Set([".ts", ".tsx", ".js", ".jsx"]);

// Padrões proibidos. Cada item: { pattern: RegExp, label: string }
// Todos aplicados ao conteúdo bruto do arquivo.
const FORBIDDEN = [
  { pattern: /\bLockedFeature\b/, label: "LockedFeature" },
  { pattern: /\bPlanPill\b/, label: "PlanPill" },
  { pattern: /\buseUserPlan\b/, label: "useUserPlan" },
  { pattern: /\bcanAccess\b/, label: "canAccess" },
  { pattern: /Fazer\s+Upgrade/i, label: "Fazer Upgrade" },
  { pattern: /Virar\s+PRO/i, label: "Virar PRO" },
  { pattern: /Desbloqueie/i, label: "Desbloqueie" },
  { pattern: /\bupgrade\b/i, label: "upgrade" },
  // "PRO" como token isolado em maiúsculas (evita falso-positivo com "Promise", "props", etc.)
  { pattern: /\bPRO\b/, label: "PRO" },
  { pattern: /\bPREMIUM\b/, label: "PREMIUM" },
  { pattern: /Plano\s+(Pro|Premium|Master|Free)/i, label: "Plano <tier>" },
];

// Comentários de anotação que autorizam ocorrências específicas (últimos recursos).
// Um arquivo pode incluir `// allow-plans-check` para ser ignorado pelo guard.
const BYPASS_MARKER = "allow-plans-check";

// Ignora este próprio script.
const SELF = relative(ROOT, new URL(import.meta.url).pathname);

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) yield* walk(full);
    else yield full;
  }
}

const violations = [];
for (const file of walk(SRC)) {
  const rel = relative(ROOT, file);
  const ext = file.slice(file.lastIndexOf("."));
  if (!EXTS.has(ext)) continue;
  const content = readFileSync(file, "utf8");
  if (content.includes(BYPASS_MARKER)) continue;

  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const { pattern, label } of FORBIDDEN) {
      if (pattern.test(line)) {
        violations.push({ file: rel, line: i + 1, label, snippet: line.trim().slice(0, 160) });
      }
    }
  }
}

if (violations.length > 0) {
  console.error(`\n❌ Guard "no-plans" falhou — ${violations.length} ocorrência(s) proibida(s):\n`);
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  [${v.label}]  ${v.snippet}`);
  }
  console.error(
    `\nRemova as referências acima. Se for absolutamente necessário, adicione\n` +
      `o comentário \`${BYPASS_MARKER}\` no arquivo para bypass explícito.\n`,
  );
  process.exit(1);
}

console.log(`✅ Guard "no-plans" ok — nenhuma referência a planos/upgrade/PRO no frontend (${SELF} inspecionou src/).`);
