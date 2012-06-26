Die Fachstelle Naturschutz des Kantons Zürich hat die sogenannte [Artendatenbank](http://www.aln.zh.ch/internet/baudirektion/aln/de/naturschutz/naturschutzdaten/tools/arten_db.html#a-content) entwickelt, in der Eigenschaften von Arten und Lebensräumen verwaltet werden. Sie basiert auf Microsoft Access.

Ich will versuchen, eine bessere Lösung mit Javascript und CouchDb zu entwickeln.
Dazu müssen zunächst mal die Daten aus Access im JSON-Format in die CouchDb importiert werden können.

Idee:
- Mit einer Tabellenerstellungsabfrage erstellt man in Access Tabellen, die alle gewünschten Informationen enthalten
- Diese CouchApp verbindet mit der gewählten Tabelle der Access-Datenbank
- Sie wandelt die Arten- und Lebensraumeigenschaften ins JSON-Format um und importiert sie in die CouchApp, deren UI noch zu entwickeln ist
- Später soll aus dieser CochApp ein Tool entstehen, mit dem Datensammlungen von den jeweiligen Datenherren hinzugefügt oder aktualisiert werden können