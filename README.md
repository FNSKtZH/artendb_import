Die Fachstelle Naturschutz des Kantons Zürich hat die sogenannte [Artendatenbank](http://www.aln.zh.ch/internet/baudirektion/aln/de/naturschutz/naturschutzdaten/tools/arten_db.html#a-content) entwickelt, in der Eigenschaften von Arten und Lebensräumen verwaltet werden. Sie basiert auf Microsoft Access.

Ich will versuchen, eine bessere Lösung mit Javascript und [CouchDb](http://couchdb.apache.org/) zu entwickeln.
Dazu müssen zunächst mal die Daten aus Access im JSON-Format in die Couch importiert werden können.

Idee:
- In Access wird eine Import-mdb erstellt, welche die Tabellen der ArtenDb.mdb einbindet und ein paar wenige weitere anbietet
- Eine [CouchApp](http://couchapp.org) verbindet mit der gewählten Tabelle der Access-Datenbank
- Sie wandelt die Arten- und Lebensraumeigenschaften ins JSON-Format um und importiert sie in die CouchApp der künftigen Artendatenbank, deren Benutzerorberfläche noch zu entwickeln ist
- Später soll aus artendb_import ein Tool entstehen, mit dem Datensammlungen von den jeweiligen Datenherren hinzugefügt oder aktualisiert werden können

Voraussetzungen:
- Der direkte Zugriff auf lokale Daten ist Web-Anwendungen normalerweise verwehrt. Darum muss ActiveX verwendet werden, was wiederum die Verwendung des Internet Explorers voraussetzt
- Die Anwendung muss gleichzeitig auf lokale Daten und auf die CouchApp im Netz zugreifen. Dieser "crossdomain"-Zugriff ist bei unbekannten Seiten ein Sicherheitsrisiko. Darum muss diese Seite in den Optionen des Internet Explorers als sichere Seite eingestellt werden und crossdomain für sichere Seiten freigegeben werden