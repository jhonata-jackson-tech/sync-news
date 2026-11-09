#!/usr/bin/env bash
# Publica o que está na branch atual, sem merge manual.
# Uso: npm run publicar -- "Descrição da mudança"     (acrescente --dry-run para só conferir)
set -euo pipefail

REPO="jhonata-jackson-tech/sync-news"
SITE="https://jhonata-jackson-tech.github.io/sync-news/"
DRY=false
MSG=""
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY=true ;;
    *) MSG="$arg" ;;
  esac
done

step() { printf '\n▶ %s\n' "$1"; }
cd "$(git rev-parse --show-toplevel)"

gh auth status >/dev/null 2>&1 || { echo "GitHub não autenticado. Rode: gh auth login"; exit 1; }

step "Conferindo testes e compilação"
npm test >/dev/null || { echo "Os testes falharam. Nada foi publicado."; exit 1; }
npm run build >/dev/null || { echo "A compilação falhou. Nada foi publicado."; exit 1; }
echo "Tudo certo."

git fetch --quiet origin main
BRANCH="$(git branch --show-current)"
DIRTY="$(git status --porcelain)"
AHEAD="$(git rev-list --count origin/main..HEAD)"

if [ -z "$DIRTY" ] && [ "$AHEAD" = "0" ]; then
  echo "Nada novo para publicar."
  exit 0
fi

[ "$BRANCH" = "main" ] && BRANCH="publicar/$(date +%Y%m%d-%H%M%S)" && NEW_BRANCH=true || NEW_BRANCH=false

if [ "$DRY" = true ]; then
  step "Simulação: nada foi enviado"
  echo "Branch: $BRANCH"
  echo "Alterações sem commit: $(printf '%s' "$DIRTY" | grep -c . || true)"
  echo "Commits à frente da main: $AHEAD"
  exit 0
fi

[ "$NEW_BRANCH" = true ] && git switch --quiet -c "$BRANCH"

if [ -n "$DIRTY" ]; then
  step "Salvando alterações"
  git add -A
  git commit --quiet -m "${MSG:-Atualização do site}"
fi

TITLE="${MSG:-$(git log -1 --format=%s)}"

step "Enviando para o GitHub"
git push --quiet -u origin "$BRANCH"

if ! gh pr view "$BRANCH" --repo "$REPO" --json state --jq .state 2>/dev/null | grep -q OPEN; then
  gh pr create --repo "$REPO" --base main --head "$BRANCH" --title "$TITLE" --body "Publicado com scripts/publicar.sh." >/dev/null
fi

step "Fazendo o merge"
gh pr merge "$BRANCH" --repo "$REPO" --squash --delete-branch
git switch --quiet main
git pull --quiet --ff-only origin main
SHA="$(git rev-parse HEAD)"

step "Aguardando o site atualizar"
RUN=""
for _ in $(seq 1 40); do
  RUN="$(gh run list --repo "$REPO" --workflow deploy.yml --branch main --json databaseId,headSha --jq ".[] | select(.headSha == \"$SHA\") | .databaseId" | head -1)"
  [ -n "$RUN" ] && break
  sleep 3
done
[ -n "$RUN" ] || { echo "Merge feito, mas a publicação não foi encontrada. Confira a aba Actions."; exit 1; }
gh run watch "$RUN" --repo "$REPO" --exit-status --interval 6 >/dev/null || { echo "A publicação falhou. Veja: https://github.com/$REPO/actions/runs/$RUN"; exit 1; }

printf '\n✔ Publicado: %s\n' "$SITE"
