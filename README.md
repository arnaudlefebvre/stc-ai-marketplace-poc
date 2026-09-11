# Marketplace IA STC - POC

POC de marketplace de plugins Codex / ChatGPT contenant des skills internes Santéclair.

## Contenu

```text
.agents/plugins/marketplace.json
plugins/
  java-tu-ti-generator/
    .codex-plugin/plugin.json
    skills/java-tu-ti-generator/
      SKILL.md
      agents/openai.yaml
      references/java-tu-ti-conventions.md
  refinement/
    .codex-plugin/plugin.json
    skills/refinement/
      SKILL.md
      agents/openai.yaml
  consolidate-jira-absences/
    .codex-plugin/plugin.json
    skills/consolidate-jira-absences/
      SKILL.md
      agents/openai.yaml
  wait-what/
    .codex-plugin/plugin.json
    skills/wait-what/
      SKILL.md
      agents/openai.yaml
  grilling/
    .codex-plugin/plugin.json
    skills/grilling/
  diagnosing-bugs/
    .codex-plugin/plugin.json
    skills/diagnosing-bugs/
  teach/
    .codex-plugin/plugin.json
    skills/teach/
  grill-with-docs/
    .codex-plugin/plugin.json
    skills/grill-with-docs/
```

Les plugins sont volontairement **skill-only** : aucun MCP ni aucune App n'est requis pour ce POC.

## Publier le POC sur GitHub

1. Creer un repository GitHub vide, par exemple `stc-ai-marketplace-poc`.
2. Pousser tout le contenu de ce dossier a la racine du repository.
3. Verifier que le fichier suivant est accessible dans la branche par defaut :
   `.agents/plugins/marketplace.json`.

## Importer la marketplace dans ChatGPT Enterprise

En tant qu'administrateur du workspace :

1. Ouvrir **Workspace settings > Plugins**.
2. Selectionner **Add > Import marketplace**.
3. Dans **Source**, saisir l'URL du repository GitHub, par exemple `https://github.com/<user>/stc-ai-marketplace-poc`.
4. Laisser **Path** vide car `.agents/plugins/marketplace.json` se trouve a la racine.
5. Laisser **Branch** vide pour suivre la branche par defaut, ou indiquer explicitement la branche de POC.
6. Importer la marketplace.
7. Verifier les deux plugins puis choisir leur politique d'installation dans le workspace.

## Tester une mise a jour

Modifier par exemple :

```text
plugins/refinement/skills/refinement/SKILL.md
```

Puis commit/push sur GitHub. Dans ChatGPT Enterprise :

**Workspace settings > Plugins > Marketplaces > Marketplace IA STC > Sync now**

Une marketplace importee depuis GitHub est ensuite synchronisee automatiquement chaque jour.

## Gouvernance cible

Pour le POC, GitHub peut etre la source directe. Pour la cible Santeclair, conserver GitLab comme source canonique et publier un miroir GitHub depuis la CI permet d'eviter de donner Git aux postes utilisateurs.

## Validation locale

Le workflow GitHub Actions `.github/workflows/validate-marketplace.yml` controle la syntaxe JSON et la presence des fichiers structurants.
