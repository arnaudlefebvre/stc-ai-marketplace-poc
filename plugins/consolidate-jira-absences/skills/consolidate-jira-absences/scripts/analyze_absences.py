#!/usr/bin/env python3
"""Analyze Jira absence CSV exports and write Markdown/JSON management reports."""
from __future__ import annotations

import argparse
import csv
import json
import re
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta
from pathlib import Path

DEFAULT_CONFIG = Path(__file__).resolve().parent.parent / "references" / "default_config.json"

MONTHS = {
    "janv.": 1, "janv": 1, "févr.": 2, "fevr.": 2, "févr": 2, "fevr": 2,
    "mars": 3, "avr.": 4, "avr": 4, "mai": 5, "juin": 6,
    "juil.": 7, "juil": 7, "août": 8, "aout": 8, "sept.": 9, "sept": 9,
    "oct.": 10, "oct": 10, "nov.": 11, "nov": 11, "déc.": 12, "dec.": 12,
    "déc": 12, "dec": 12,
}


def parse_date(value: str) -> date | None:
    value = (value or "").strip()
    if not value:
        return None
    # Jira API timestamp style, including timezone offsets.
    iso_value = value.replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(iso_value).date()
    except ValueError:
        pass
    # Jira export style: 03/sept./26 7:00 AM
    match = re.match(r"^(\d{1,2})/([^/]+)/([0-9]{2,4})(?:\s+.*)?$", value, re.I)
    if match:
        day, month_text, year = match.groups()
        month = MONTHS.get(month_text.lower())
        if month:
            year = int(year)
            year += 2000 if year < 100 else 0
            return date(year, month, int(day))
    # French text style: 03 août 2026 07:47
    parts = value.replace(",", " ").split()
    if len(parts) >= 3 and parts[1].lower() in MONTHS:
        return date(int(parts[2]), MONTHS[parts[1].lower()], int(parts[0]))
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y"):
        try:
            return datetime.strptime(value.split()[0], fmt).date()
        except ValueError:
            pass
    return None


def detect_delimiter(path: Path) -> str:
    sample = path.read_text(encoding="utf-8-sig", errors="replace")[:8192]
    return ";" if sample.count(";") > sample.count(",") else ","


def find_column(headers, candidates, required=False):
    normalized = {h.strip().lower(): h for h in headers}
    for candidate in candidates:
        if candidate.lower() in normalized:
            return normalized[candidate.lower()]
    for header in headers:
        low = header.lower()
        if any(candidate.lower() in low for candidate in candidates):
            return header
    if required:
        raise ValueError(f"Missing required column; tried: {candidates}")
    return None


def merge_intervals(intervals):
    merged = []
    for start, end in sorted(intervals):
        if not merged or start > merged[-1][1] + timedelta(days=1):
            merged.append([start, end])
        else:
            merged[-1][1] = max(merged[-1][1], end)
    return [(a, b) for a, b in merged]


def dates_in(start, end):
    current = start
    while current <= end:
        yield current
        current += timedelta(days=1)


def intervals_from_dates(values):
    ordered = sorted(set(values))
    if not ordered:
        return []
    result = []
    start = previous = ordered[0]
    for current in ordered[1:]:
        if current != previous + timedelta(days=1):
            result.append((start, previous))
            start = current
        previous = current
    result.append((start, previous))
    return result


def fmt_interval(interval):
    start, end = interval
    return str(start) if start == end else f"{start} -> {end}"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv")
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--period-start", required=True)
    parser.add_argument("--period-end", required=True)
    parser.add_argument("--teams-json")
    parser.add_argument("--config", default=str(DEFAULT_CONFIG))
    parser.add_argument("--source", choices=("CSV", "Jira"), default="CSV")
    parser.add_argument("--jira-json", help="Normalized Jira payload written by the Atlassian connector")
    args = parser.parse_args()
    if not args.csv and not args.jira_json:
        parser.error("--csv or --jira-json is required")

    period_start = date.fromisoformat(args.period_start)
    period_end = date.fromisoformat(args.period_end)
    config = json.loads(Path(args.config).read_text(encoding="utf-8"))
    teams = json.loads(Path(args.teams_json).read_text(encoding="utf-8")) if args.teams_json else config["teams"]
    aliases = {str(k): str(v) for k, v in config.get("aliases", {}).items()}
    people = {person: (team, role) for team, members in teams.items() for person, role in members.items()}
    accepted = {status.casefold() for status in config.get("accepted_statuses", ["Clos", "Accepté"])} | {"accepte", "accepted"}

    def compact(value):
        import unicodedata
        value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
        return re.sub(r"[^a-z0-9]", "", value.lower())

    def resolve_owner(value):
        if value in aliases:
            return aliases[value]
        if value in people:
            return value
        tokens = [compact(token) for token in value.split() if compact(token)]
        if not tokens:
            return value
        candidates = {tokens[-1], tokens[0][0] + tokens[-1]}
        if len(tokens[0]) > 1:
            candidates.add(tokens[0][0] + tokens[-1])
        for alias in people:
            if compact(alias) in candidates:
                return alias
        compact_value = compact(value)
        for alias, canonical in aliases.items():
            if compact(alias) == compact_value:
                return canonical
        return value

    delimiter = None
    if args.jira_json:
        payload = json.loads(Path(args.jira_json).read_text(encoding="utf-8"))
        rows = payload.get("issues", payload if isinstance(payload, list) else [])
        normalized_rows = []
        for issue in rows:
            fields = issue.get("fields", issue)
            custom = fields.get("customFields", {})
            def jira_value(name, fallback=""):
                value = custom.get(name, {}).get("value", fallback)
                return value if isinstance(value, str) else fallback
            normalized_rows.append({
                "Key": issue.get("key", fields.get("key", "")),
                "Summary": fields.get("summary", ""),
                "Reporter": fields.get("reporter", {}).get("displayName", fields.get("reporter", "")) if isinstance(fields.get("reporter", ""), dict) else fields.get("reporter", ""),
                "Status": fields.get("status", {}).get("name", fields.get("status", "")) if isinstance(fields.get("status", ""), dict) else fields.get("status", ""),
                "Date - heure de début": jira_value("Date - heure de début"),
                "Date - heure de fin": jira_value("Date - heure de fin"),
                "Created": fields.get("created", ""),
            })
        rows = normalized_rows
    else:
        csv_path = Path(args.csv)
        delimiter = detect_delimiter(csv_path)
        with csv_path.open(encoding="utf-8-sig", newline="") as handle:
            rows = list(csv.DictReader(handle, delimiter=delimiter))
    headers = rows[0].keys() if rows else []
    key_col = find_column(headers, ["Clé de ticket", "Key", "Issue key"], True)
    summary_col = find_column(headers, ["Résumé", "Summary"])
    person_col = find_column(headers, ["Rapporteur", "Reporter", "Personne assignée", "Assignee"], True)
    status_col = find_column(headers, ["État", "Etat", "Status"], True)
    start_col = find_column(headers, ["Date - heure de début", "Date - heure de debut", "Start date"], True)
    end_col = find_column(headers, ["Date - heure de fin", "Date - heure de fin", "End date"], True)
    created_col = find_column(headers, ["Création", "Creation", "Created"])

    tickets = []
    quality = {"excluded": [], "unknown_statuses": [], "pages": None, "total_retrieved": len(rows)}
    if args.jira_json:
        jira_meta = json.loads(Path(args.jira_json).read_text(encoding="utf-8"))
        quality["pages"] = jira_meta.get("pages")
        quality["total_retrieved"] = jira_meta.get("total_retrieved", len(rows))
    unknown = set()
    unknown_tickets = []
    for row in rows:
        raw_owner = (row.get(person_col) or "").strip()
        owner = resolve_owner(raw_owner)
        start = parse_date(row.get(start_col, ""))
        end = parse_date(row.get(end_col, ""))
        if not raw_owner:
            quality["excluded"].append({"key": row.get(key_col, ""), "reason": "reporter_missing"})
            continue
        if not start or not end:
            quality["excluded"].append({"key": row.get(key_col, ""), "reason": "date_missing_or_invalid"})
            continue
        if start > end:
            quality["excluded"].append({"key": row.get(key_col, ""), "reason": "dates_inverted"})
            continue
        if end < period_start or start > period_end:
            continue
        start, end = max(start, period_start), min(end, period_end)
        ticket = {
            "key": row.get(key_col, ""), "summary": (row.get(summary_col) or "").strip(),
            "owner": owner, "status": (row.get(status_col) or "").strip(),
            "start": start, "end": end,
            "created": parse_date(row.get(created_col, "")) if created_col else None,
        }
        tickets.append(ticket)
        if ticket["status"].casefold() not in accepted:
            quality["unknown_statuses"].append(ticket["status"])
        if owner not in people:
            unknown.add(owner)
            unknown_tickets.append(ticket)

    by_person = defaultdict(list)
    for ticket in tickets:
        by_person[ticket["owner"]].append(ticket)

    person_summary = {}
    for person, (team, role) in people.items():
        person_tickets = by_person.get(person, [])
        intervals = [(t["start"], t["end"]) for t in person_tickets]
        merged = merge_intervals(intervals)
        longest = max(((b - a).days + 1 for a, b in merged), default=0)
        accepted_count = sum(t["status"].casefold() in accepted for t in person_tickets)
        created_dates = [t["created"] for t in person_tickets if t["created"]]
        person_summary[person] = {
            "team": team, "role": role, "ticket_count": len(person_tickets),
            "accepted": accepted_count, "pending": len(person_tickets) - accepted_count,
            "longest_continuous_days": longest, "two_weeks_compliant": longest >= 14,
            "first_declaration": min(created_dates).isoformat() if created_dates else None,
            "tickets": [{**t, "start": str(t["start"]), "end": str(t["end"]), "created": str(t["created"]) if t["created"] else None} for t in person_tickets],
        }

    internal_gaps = defaultdict(list)
    product_gaps = defaultdict(list)
    person_overlaps = []
    duplicate_declarations = []
    for team, members in teams.items():
        overlap_days = []
        duplicate_days = []
        for current in dates_in(period_start, period_end):
            absent = [p for p in members if any(t["start"] <= current <= t["end"] for t in by_person.get(p, []))]
            present = [p for p in members if p not in absent]
            if not any(members[p] == "Interne" for p in present):
                internal_gaps[team].append(current)
            if not present:
                product_gaps[team].append(current)
            if len(absent) >= 2:
                overlap_days.append((current, absent))
            for person in absent:
                declarations = [t for t in by_person.get(person, []) if t["start"] <= current <= t["end"]]
                if len(declarations) >= 2:
                    duplicate_days.append((current, person, sorted(t["key"] for t in declarations)))
        for start, end in intervals_from_dates([day for day, _ in overlap_days]):
            affected = sorted({person for day, absent in overlap_days if start <= day <= end for person in absent})
            person_overlaps.append({"type": "person_overlap", "team": team, "start": str(start), "end": str(end), "people": affected,
                             "internal_gap": any(start <= d <= end for d in internal_gaps[team]),
                             "product_gap": any(start <= d <= end for d in product_gaps[team])})
        seen_duplicates = {(day, person, tuple(keys)) for day, person, keys in duplicate_days}
        for day, person, keys in sorted(seen_duplicates):
            duplicate_declarations.append({"type": "duplicate_declaration", "team": team, "date": str(day), "person": person, "tickets": list(keys)})

    unknown_dates = sorted({day for ticket in unknown_tickets for day in dates_in(ticket["start"], ticket["end"])})
    coverage_uncertainties = [{"date": str(day), "reason": "inconclusive_due_to_unknown_reporter", "reporters": sorted({t["owner"] for t in unknown_tickets if t["start"] <= day <= t["end"]})} for day in unknown_dates]

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    report_path = output_dir / f"consolidation_conges_{period_start.isoformat()}.md"
    json_path = output_dir / f"consolidation_conges_{period_start.isoformat()}.json"
    completeness = "complète" if not quality["excluded"] and (quality["pages"] is None or quality["pages"] >= 1) else "partielle"
    lines = ["# Consolidation des congés", "", f"- Source: {args.source}", f"- Période: {period_start} au {period_end}", f"- Tickets récupérés: {quality['total_retrieved']}", f"- Tickets analysés: {len(tickets)}", f"- Complétude: **{completeness}**", f"- Pages Jira: {quality['pages'] if quality['pages'] is not None else 'N/A'}", f"- Délimiteur détecté: `{delimiter or 'N/A'}`", ""]
    lines += ["## Qualité des données", "", f"- Tickets exclus: {len(quality['excluded'])}", f"- Statuts non acceptés ou à confirmer: {len(set(quality['unknown_statuses']))}", ""]
    if quality["excluded"]:
        lines += ["| Ticket | Motif |", "| --- | --- |"] + [f"| {item['key'] or 'inconnu'} | {item['reason']} |" for item in quality["excluded"]] + [""]
    lines += ["## Vue par personne", "", "| Personne | Equipe | Role | Tickets | Acceptes | En attente | Plus longue absence | Regle 14 jours |", "| --- | --- | --- | ---: | ---: | ---: | ---: | --- |"]
    for person in sorted(person_summary):
        s = person_summary[person]
        lines.append(f"| {person} | {s['team']} | {s['role']} | {s['ticket_count']} | {s['accepted']} | {s['pending']} | {s['longest_continuous_days']} j | {'Oui' if s['two_weeks_compliant'] else 'Non'} |")
    lines += ["", "## Personnes sans congé déclaré", ""]
    missing = [p for p in people if not by_person.get(p)]
    lines += [f"- {p} ({people[p][0]})" for p in missing] or ["- Aucune"]
    lines += ["", "## Internes ne respectant pas la règle des 14 jours", ""]
    non_compliant = [p for p in people if people[p][1] == "Interne" and not person_summary[p]["two_weeks_compliant"]]
    lines += [f"- {p} ({person_summary[p]['longest_continuous_days']} jours max)" for p in non_compliant] or ["- Aucun"]
    lines += ["", "## Chevauchements entre personnes", ""]
    lines += [f"- {o['team']} {o['start']} -> {o['end']}: {', '.join(o['people'])}" + (" [risque interne]" if o['internal_gap'] else "") + (" [rupture produit]" if o['product_gap'] else "") for o in person_overlaps] or ["- Aucun"]
    lines += ["", "## Déclarations multiples d'une même personne", ""]
    lines += [f"- {o['team']} {o['date']}: {o['person']} ({', '.join(o['tickets'])})" for o in duplicate_declarations] or ["- Aucune"]
    lines += ["", "## Couverture non concluante", ""]
    lines += [f"- {o['date']}: reporter(s) inconnu(s) {', '.join(o['reporters'])}; la couverture ne peut pas être totalement conclue." for o in coverage_uncertainties] or ["- Aucune"]
    lines += ["", "## Couverture", ""]
    for team in teams:
        lines.append(f"### {team}")
        lines += [f"- Sans interne: {fmt_interval(i)}" for i in intervals_from_dates(internal_gaps[team])] or ["- Aucun jour sans interne"]
        lines += [f"- Sans personne: {fmt_interval(i)}" for i in intervals_from_dates(product_gaps[team])] or ["- Aucun jour sans couverture produit"]
    lines += ["", "## Calendrier visuel", "", "```mermaid", "gantt", "    title Calendrier des absences", "    dateFormat YYYY-MM-DD", "    axisFormat %d/%m"]
    for team, members in teams.items():
        lines.append(f"    section {team}")
        for ticket in sorted((t for t in tickets if t['owner'] in members), key=lambda t: (t['start'], t['owner'])):
            lines.append(f"    {ticket['owner']} {ticket['key']} : {ticket['start']}, {ticket['end']}")
    lines.append("```")
    if unknown:
        lines += ["", "## Reporters hors périmètre", ""] + [f"- {p}" for p in sorted(unknown)]
    pending_tickets = [t for t in tickets if t["status"].casefold() not in accepted]
    lines += ["", "## Synthèse managériale", ""]
    lines.append(f"- {len(tickets)} absence(s) sont planifiées sur la période, dont {len(tickets) - len(pending_tickets)} acceptée(s) et {len(pending_tickets)} à confirmer.")
    if person_overlaps:
        lines.append(f"- {len(person_overlaps)} chevauchement(s) entre personnes ont été détecté(s) ; leur niveau de risque doit être confirmé pour les tickets non acceptés.")
    else:
        lines.append("- Aucun chevauchement d'absence entre personnes différentes n'a été détecté.")
    if duplicate_declarations:
        lines.append(f"- {len(duplicate_declarations)} déclaration(s) multiple(s) concernent la même personne ; elles ne constituent pas automatiquement un risque de couverture.")
    if coverage_uncertainties:
        lines.append(f"- {len(coverage_uncertainties)} jour(s) de couverture sont non concluants car un reporter inconnu peut appartenir à l'équipe concernée.")
    if unknown:
        lines.append(f"- {len(unknown)} reporter(s) ne sont pas résolus dans le mapping d'équipe et doivent être vérifiés.")
    if quality["excluded"]:
        lines.append("- La projection est partielle car certains tickets ont été exclus pour qualité de données.")
    else:
        lines.append("- La projection est complète pour les tickets récupérés, sous réserve de la validation des statuts en attente.")
    report_path.write_text("\n".join(lines), encoding="utf-8")
    json_path.write_text(json.dumps({"period": [str(period_start), str(period_end)], "source": args.source, "completeness": completeness, "tickets_retrieved": quality["total_retrieved"], "tickets": len(tickets), "quality": quality, "status_counts": dict(Counter(t['status'] for t in tickets)), "unknown_reporters": sorted(unknown), "persons": person_summary, "person_overlaps": person_overlaps, "duplicate_declarations": duplicate_declarations, "coverage_uncertainties": coverage_uncertainties, "internal_gaps": {k: [str(i) for i in intervals_from_dates(v)] for k, v in internal_gaps.items()}, "product_gaps": {k: [str(i) for i in intervals_from_dates(v)] for k, v in product_gaps.items()}}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(report_path)
    print(json_path)


if __name__ == "__main__":
    main()





