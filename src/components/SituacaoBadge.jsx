import { normalizeText } from "../utils/formatters";

export default function SituacaoBadge({ situacao }) {
  if (!situacao) return null;
  const desc = typeof situacao === "object" ? situacao.descricao : situacao;
  if (!desc) return null;
  const ativa = normalizeText(desc).includes("ativa");
  return (
    <span className={"sit-badge " + (ativa ? "sit-ativa" : "sit-inativa")}>
      <span className={"dot " + (ativa ? "dot-green" : "dot-red")} />
      {desc}
    </span>
  );
}
