# Dashboard: Standortbilder und Profilwerte

## Kontext
Das NOXIA-Dashboard wurde zugunsten einer größeren Kolonie-/Grid-Arbeitsfläche verdichtet. Dabei ist die große Profilkarte entfallen. Dadurch fehlen nun die zuvor sichtbaren persönlichen Profil-/Kompetenzwerte. Außerdem soll die vorhandene Bildwelt der Planeten, Monde und Stationen stärker genutzt werden.

## Anforderung
1. In der kompakten Standortnavigation (`Deine Orte`) die bereits im Projekt vorhandenen Bilder/Illustrationen der jeweiligen Planeten, Monde und Stationen einblenden, statt die Orte nur als Text-/Emoji-Chips darzustellen.
2. Vorhandene Assets wiederverwenden; keine neuen Standortbilder erzeugen, solange passende Assets existieren.
3. Die Standortnavigation kompakt halten: Bild/Thumbnail + Name + ggf. `HIER`/aktiver Zustand. Sie darf die neu gewonnene Grid-Fläche nicht wieder wesentlich verkleinern.
4. Die persönlichen Profilwerte wieder dauerhaft im Dashboard sichtbar machen. Die frühere große Profilkarte soll **nicht** zurückkehren.
5. Profilwerte vorzugsweise als kompakte Statuszeile im Header oder als sehr schmale Leiste darstellen. Mindestens die bislang sichtbaren Werte `Trades`, `Flüge` und `Wissen`/Kompetenzfortschritt sollen wieder erkennbar sein; Klick kann weiterhin das Vollprofil öffnen.
6. Redundanzen vermeiden: Credits, Frachter/Laderaum und Standort sind bereits im Header vorhanden und müssen nicht in einer zweiten großen Profilkarte wiederholt werden.

## UX-Ziel
Das Grid bleibt visuell dominant und möglichst groß. Standortbilder schaffen Orientierung und Atmosphäre, während die persönlichen Werte auf einen Blick verfügbar bleiben, ohne eine eigene große Dashboard-Karte zu beanspruchen.

## Akzeptanzkriterien
- vorhandene Standortbilder werden in der Ortsnavigation sichtbar genutzt;
- aktueller Standort ist eindeutig markiert;
- Profil-/Kompetenzwerte sind ohne Öffnen des Profils sichtbar;
- keine Wiederherstellung der alten großen Profilkarte;
- Desktop-Grid verliert gegenüber dem aktuellen verdichteten Layout kaum Nutzfläche;
- responsive Darstellung bleibt nutzbar.